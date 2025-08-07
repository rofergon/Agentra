// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./HederaTokenService.sol";

// Interface for SaucerSwap Router V1 (0.0.19264)
interface ISaucerSwapRouter {
    // View functions
    function WHBAR() external view returns (address);
    function whbar() external view returns (address);
    function factory() external view returns (address);
    
    // Utility functions
    function getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut) 
        external pure returns (uint256 amountIn);
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) 
        external pure returns (uint256 amountOut);
    function getAmountsIn(uint256 amountOut, address[] calldata path) 
        external view returns (uint256[] memory amounts);
    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external view returns (uint256[] memory amounts);
    function quote(uint256 amountA, uint256 reserveA, uint256 reserveB) 
        external pure returns (uint256 amountB);
    
    // Swap functions
    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);
    
    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
    
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
    
    function swapETHForExactTokens(
        uint256 amountOut, 
        address[] calldata path, 
        address to, 
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);
    
    function swapTokensForExactETH(
        uint256 amountOut, 
        uint256 amountInMax, 
        address[] calldata path, 
        address to, 
        uint256 deadline
    ) external returns (uint256[] memory amounts);
    
    function swapTokensForExactTokens(
        uint256 amountOut, 
        uint256 amountInMax, 
        address[] calldata path, 
        address to, 
        uint256 deadline
    ) external returns (uint256[] memory amounts);
    
    // Fee-on-transfer token support
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256 amountOutMin, 
        address[] calldata path, 
        address to, 
        uint256 deadline
    ) external payable;
    
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn, 
        uint256 amountOutMin, 
        address[] calldata path, 
        address to, 
        uint256 deadline
    ) external;
    
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn, 
        uint256 amountOutMin, 
        address[] calldata path, 
        address to, 
        uint256 deadline
    ) external;
    
    // Liquidity functions
    function addLiquidity(
        address tokenA, 
        address tokenB, 
        uint256 amountADesired, 
        uint256 amountBDesired, 
        uint256 amountAMin, 
        uint256 amountBMin, 
        address to, 
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);
    
    function addLiquidityETH(
        address token, 
        uint256 amountTokenDesired, 
        uint256 amountTokenMin, 
        uint256 amountETHMin, 
        address to, 
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);
    
    function removeLiquidity(
        address tokenA, 
        address tokenB, 
        uint256 liquidity, 
        uint256 amountAMin, 
        uint256 amountBMin, 
        address to, 
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);
    
    function removeLiquidityETH(
        address token, 
        uint256 liquidity, 
        uint256 amountTokenMin, 
        uint256 amountETHMin, 
        address to, 
        uint256 deadline
    ) external returns (uint256 amountToken, uint256 amountETH);
    
    // Special functions
    function tinycentsToTinybars(uint256 tinycents) external returns (uint256 tinybars);
}

/**
 * @title AutoSwapLimit
 * @dev Automation contract for limit swaps using SaucerSwap on Hedera
 * Users deposit HBAR and create limit orders that can be executed by authorized executors or anyone
 */
contract AutoSwapLimit is Ownable, ReentrancyGuard, HederaTokenService {
    
    struct SwapOrder {
        address tokenOut;       // Token to receive from swap
        uint256 amountIn;       // Amount of HBAR deposited
        uint256 minAmountOut;   // Minimum amount of tokens to receive
        uint256 triggerPrice;   // Price that triggers the swap (token price in terms of HBAR)
        address owner;          // Order owner
        bool isActive;          // Whether the order is active
        uint256 expirationTime; // Expiration time
        bool isExecuted;        // Whether the order was executed
    }
    
    // SaucerSwap Router V1 (0.0.19264) - Used for amounts <= 180 HBAR
    ISaucerSwapRouter public immutable saucerSwapRouter;
    
    // NOTE: For amounts > 180 HBAR, frontend uses SaucerSwapV2SwapRouter (0.0.1414040)
    // This will be implemented in a future version
    uint256 public constant ROUTER_THRESHOLD = 18000000000; // 180 HBAR in tinybars
    
    // WHBAR address - obtained dynamically from router for accuracy
    address public immutable WETH; // WHBAR token address
    
    // Common tokens for routing (Hedera Testnet addresses - verified)
    address public constant WHBAR_FOR_PATH = 0x0000000000000000000000000000000000003aD2; // WHBAR real address for paths
    address public constant USDC = 0x00000000000000000000000000000000000014F5; // USDC testnet (0.0.5349) - Dirección corregida
    address public constant SAUCE = 0x0000000000000000000000000000000000120f46; // SAUCE testnet (0.0.1183558)
    // Note: USDT is not available on SaucerSwap testnet
    
    // Lista de tokens que el contrato puede manejar
    address[] public supportedTokens;
    mapping(address => bool) public isSupportedToken;
    
    // Mappings for orders
    mapping(uint256 => SwapOrder) public swapOrders;
    mapping(address => uint256[]) public userOrders;
    
    // Executor management
    mapping(address => bool) public authorizedExecutors;
    address[] public executorList;
    
    uint256 public nextOrderId = 1;
    uint256 public executionFee = 10000000; // 0.1 HBAR in tinybars (flexible for Hedera)
    uint256 public constant MIN_ORDER_AMOUNT = 1000000; // 0.01 HBAR minimum order
    
    // Execution modes
    bool public publicExecutionEnabled = true; // Allow anyone to execute orders
    
    // Backend executor address (primary executor)
    address public backendExecutor;
    
    // Events
    event OrderCreated(
        uint256 indexed orderId,
        address indexed user,
        address tokenOut,
        uint256 amountIn,
        uint256 triggerPrice
    );
    
    event OrderExecuted(
        uint256 indexed orderId,
        address indexed executor,
        uint256 amountOut,
        uint256 executionPrice
    );
    
    event OrderCancelled(uint256 indexed orderId, address indexed user);
    
    event BackendExecutorUpdated(address indexed oldExecutor, address indexed newExecutor);
    
    event ExecutionFeeUpdated(uint256 indexed oldFee, uint256 indexed newFee);
    
    event ExecutorAdded(address indexed executor);
    
    event ExecutorRemoved(address indexed executor);
    
    event PublicExecutionToggled(bool enabled);
    
    event RouterThresholdExceeded(uint256 indexed orderId, uint256 amount, uint256 threshold);
    
    event TokenAssociated(address indexed token, int responseCode);
    
    event TokensAssociated(address[] tokens, int responseCode);
    
    event SupportedTokenAdded(address indexed token);
    
    event SupportedTokenRemoved(address indexed token);
    
    modifier onlyOrderOwner(uint256 orderId) {
        require(swapOrders[orderId].owner == msg.sender, "You are not the owner of this order");
        _;
    }
    
    modifier onlyActiveOrder(uint256 orderId) {
        require(swapOrders[orderId].isActive, "Order not active");
        require(!swapOrders[orderId].isExecuted, "Order already executed");
        require(block.timestamp < swapOrders[orderId].expirationTime, "Order expired");
        _;
    }
    
    modifier onlyAuthorizedExecutor() {
        require(
            publicExecutionEnabled || 
            authorizedExecutors[msg.sender] || 
            msg.sender == backendExecutor || 
            msg.sender == owner(), 
            "Not authorized to execute orders"
        );
        _;
    }
    
    constructor(address _saucerSwapRouter, address _backendExecutor) Ownable(msg.sender) {
        require(_saucerSwapRouter != address(0), "Router address cannot be zero");
        require(_backendExecutor != address(0), "Backend executor cannot be zero");
        
        saucerSwapRouter = ISaucerSwapRouter(_saucerSwapRouter);
        
        // Get WHBAR address dynamically from router for accuracy
        WETH = saucerSwapRouter.WHBAR();
        require(WETH != address(0), "WHBAR address from router cannot be zero");
        
        backendExecutor = _backendExecutor;
        
        // Add backend executor to authorized list
        authorizedExecutors[_backendExecutor] = true;
        executorList.push(_backendExecutor);
        
        // Inicializar tokens soportados
        supportedTokens.push(USDC);
        supportedTokens.push(SAUCE);
        isSupportedToken[USDC] = true;
        isSupportedToken[SAUCE] = true;
        
        // Asociar automáticamente los tokens principales al contrato
        _associateTokensToContract();
    }
    
    /**
     * @dev Asocia automáticamente los tokens principales al contrato
     */
    function _associateTokensToContract() private {
        address[] memory tokensToAssociate = new address[](2);
        tokensToAssociate[0] = USDC;
        tokensToAssociate[1] = SAUCE;
        
        int responseCode = associateTokens(address(this), tokensToAssociate);
        emit TokensAssociated(tokensToAssociate, responseCode);
    }
    
    /**
     * @dev Asocia un token específico al contrato (owner only)
     * @param token Dirección del token a asociar
     */
    function associateTokenToContract(address token) external onlyOwner {
        require(token != address(0), "Token address cannot be zero");
        
        int responseCode = associateToken(address(this), token);
        emit TokenAssociated(token, responseCode);
        
        // Agregar a la lista de tokens soportados si la asociación fue exitosa
        if (responseCode == HederaResponseCodes.SUCCESS && !isSupportedToken[token]) {
            supportedTokens.push(token);
            isSupportedToken[token] = true;
            emit SupportedTokenAdded(token);
        }
    }
    
    /**
     * @dev Asocia múltiples tokens al contrato (owner only)
     * @param tokens Array de direcciones de tokens a asociar
     */
    function associateTokensToContract(address[] memory tokens) external onlyOwner {
        require(tokens.length > 0, "Tokens array cannot be empty");
        
        int responseCode = associateTokens(address(this), tokens);
        emit TokensAssociated(tokens, responseCode);
        
        // Agregar a la lista de tokens soportados si la asociación fue exitosa
        if (responseCode == HederaResponseCodes.SUCCESS) {
            for (uint256 i = 0; i < tokens.length; i++) {
                if (!isSupportedToken[tokens[i]]) {
                    supportedTokens.push(tokens[i]);
                    isSupportedToken[tokens[i]] = true;
                    emit SupportedTokenAdded(tokens[i]);
                }
            }
        }
    }
    
    /**
     * @dev Remueve un token de la lista de tokens soportados (owner only)
     * @param token Dirección del token a remover
     */
    function removeSupportedToken(address token) external onlyOwner {
        require(isSupportedToken[token], "Token is not supported");
        
        isSupportedToken[token] = false;
        
        // Remover del array
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            if (supportedTokens[i] == token) {
                supportedTokens[i] = supportedTokens[supportedTokens.length - 1];
                supportedTokens.pop();
                break;
            }
        }
        
        emit SupportedTokenRemoved(token);
    }

    /**
     * @dev Create a new automatic swap order from HBAR to token
     * @param tokenOut Address of the token to receive
     * @param minAmountOut Minimum amount of tokens to receive
     * @param triggerPrice Price that triggers the swap (token price in HBAR)
     * @param expirationTime Order expiration time
     */
    function createSwapOrder(
        address tokenOut,
        uint256 minAmountOut,
        uint256 triggerPrice,
        uint256 expirationTime
    ) external payable {
        require(msg.value > executionFee, "Insufficient HBAR: must exceed execution fee");
        require(minAmountOut > 0, "Minimum amount must be greater than 0");
        require(triggerPrice > 0, "Trigger price must be greater than 0");
        require(expirationTime > block.timestamp, "Expiration time must be in the future");
        require(expirationTime <= block.timestamp + 30 days, "Expiration time too far in future");
        require(tokenOut != address(0), "Invalid output token address");
        require(isSupportedToken[tokenOut], "Token not supported by contract");
        
        uint256 hbarForSwap = msg.value - executionFee;
        require(hbarForSwap >= MIN_ORDER_AMOUNT, "Order amount too small: must be at least MIN_ORDER_AMOUNT");
        
        // Validate amount is within router V1 limits (<=180 HBAR)
        require(hbarForSwap <= ROUTER_THRESHOLD, "Order amount too large: exceeds 180 HBAR limit for router V1");
        
        // Create order
        swapOrders[nextOrderId] = SwapOrder({
            tokenOut: tokenOut,
            amountIn: hbarForSwap,
            minAmountOut: minAmountOut,
            triggerPrice: triggerPrice,
            owner: msg.sender,
            isActive: true,
            expirationTime: expirationTime,
            isExecuted: false
        });
        
        userOrders[msg.sender].push(nextOrderId);
        
        emit OrderCreated(
            nextOrderId,
            msg.sender,
            tokenOut,
            hbarForSwap,
            triggerPrice
        );
        
        nextOrderId++;
    }
    
    /**
     * @dev Execute a swap order (public or authorized executors)
     * @param orderId ID of the order to execute
     * @param currentPrice Current token price in terms of HBAR (verified by oracle)
     */
    function executeSwapOrder(uint256 orderId, uint256 currentPrice) 
        external 
        nonReentrant 
        onlyAuthorizedExecutor
        onlyActiveOrder(orderId) 
    {
        SwapOrder storage order = swapOrders[orderId];
        
        // Verify that the price meets the trigger condition
        require(currentPrice >= order.triggerPrice, "Price does not reach trigger");
        
        // Verify order is within router V1 limits
        require(_isWithinRouterV1Limits(order.amountIn), "Order exceeds router V1 limit");
        
        // Mark order as executed before swap (to prevent re-entrancy)
        order.isActive = false;
        order.isExecuted = true;
        
        // Create intelligent path for swap
        address[] memory path = _getOptimalPath(order.tokenOut);
        
        // Calculate deadline (10 minutes from now)
        uint256 deadline = block.timestamp + 600;
        
        // Execute real swap on SaucerSwap
        uint256[] memory amounts = saucerSwapRouter.swapExactETHForTokens{value: order.amountIn}(
            order.minAmountOut,  // amountOutMin
            path,                // path
            address(this),       // to (send tokens to contract first)
            deadline             // deadline
        );
        
        // amounts[path.length - 1] is the amount of tokens received
        uint256 amountOut = amounts[path.length - 1];
        
        // Transfer tokens from contract to user using HTS
        int responseCode = transferToken(order.tokenOut, address(this), order.owner, int64(uint64(amountOut)));
        require(responseCode == HederaResponseCodes.SUCCESS, "Token transfer to user failed");
        
        // Pay fee to executor (whoever executed the order)
        payable(msg.sender).transfer(executionFee);
        
        emit OrderExecuted(orderId, msg.sender, amountOut, currentPrice);
    }
    
    /**
     * @dev Cancel a swap order
     * @param orderId ID of the order to cancel
     */
    function cancelSwapOrder(uint256 orderId) 
        external 
        onlyOrderOwner(orderId) 
        onlyActiveOrder(orderId) 
    {
        SwapOrder storage order = swapOrders[orderId];
        
        // Mark as inactive
        order.isActive = false;
        
        // Return deposited HBAR to owner
        payable(order.owner).transfer(order.amountIn);
        
        // Return execution fee
        payable(order.owner).transfer(executionFee);
        
        emit OrderCancelled(orderId, msg.sender);
    }
    
    /**
     * @dev Add authorized executor (owner only)
     * @param executor Address to authorize
     */
    function addExecutor(address executor) external onlyOwner {
        require(executor != address(0), "Executor cannot be zero address");
        require(!authorizedExecutors[executor], "Executor already authorized");
        
        authorizedExecutors[executor] = true;
        executorList.push(executor);
        
        emit ExecutorAdded(executor);
    }
    
    /**
     * @dev Remove authorized executor (owner only)
     * @param executor Address to remove
     */
    function removeExecutor(address executor) external onlyOwner {
        require(authorizedExecutors[executor], "Executor not authorized");
        require(executor != backendExecutor, "Cannot remove backend executor");
        
        authorizedExecutors[executor] = false;
        
        // Remove from executorList
        for (uint256 i = 0; i < executorList.length; i++) {
            if (executorList[i] == executor) {
                executorList[i] = executorList[executorList.length - 1];
                executorList.pop();
                break;
            }
        }
        
        emit ExecutorRemoved(executor);
    }
    
    /**
     * @dev Toggle public execution (owner only)
     * @param enabled Whether to enable public execution
     */
    function togglePublicExecution(bool enabled) external onlyOwner {
        publicExecutionEnabled = enabled;
        emit PublicExecutionToggled(enabled);
    }
    
    /**
     * @dev Get list of authorized executors
     */
    function getAuthorizedExecutors() external view returns (address[] memory) {
        return executorList;
    }
    
    /**
     * @dev Check if address is authorized executor
     */
    function isAuthorizedExecutor(address executor) external view returns (bool) {
        return authorizedExecutors[executor] || executor == backendExecutor || executor == owner();
    }
    
    /**
     * @dev Get user orders
     * @param user User address
     * @return Array of order IDs
     */
    function getUserOrders(address user) external view returns (uint256[] memory) {
        return userOrders[user];
    }
    
    /**
     * @dev Get order details
     * @param orderId Order ID
     * @return Order details
     */
    function getOrderDetails(uint256 orderId) external view returns (SwapOrder memory) {
        return swapOrders[orderId];
    }
    
    /**
     * @dev Update backend executor address (owner only)
     * @param newBackendExecutor New backend executor address
     */
    function updateBackendExecutor(address newBackendExecutor) external onlyOwner {
        require(newBackendExecutor != address(0), "Backend executor cannot be zero");
        
        // Remove old backend executor from authorized list
        authorizedExecutors[backendExecutor] = false;
        
        // Remove from executorList
        for (uint256 i = 0; i < executorList.length; i++) {
            if (executorList[i] == backendExecutor) {
                executorList[i] = executorList[executorList.length - 1];
                executorList.pop();
                break;
            }
        }
        
        address oldExecutor = backendExecutor;
        backendExecutor = newBackendExecutor;
        
        // Add new backend executor to authorized list
        authorizedExecutors[newBackendExecutor] = true;
        executorList.push(newBackendExecutor);
        
        emit BackendExecutorUpdated(oldExecutor, newBackendExecutor);
    }
    
    /**
     * @dev Get estimated quote from SaucerSwap
     * @param tokenOut Output token address
     * @param amountIn Input HBAR amount
     * @return Estimated output token amount
     */
    function getEstimatedAmountOut(address tokenOut, uint256 amountIn) 
        external view returns (uint256) {
        address[] memory path = _getOptimalPath(tokenOut);
        
        uint256[] memory amounts = saucerSwapRouter.getAmountsOut(amountIn, path);
        return amounts[path.length - 1]; // Output token amount
    }
    
    /**
     * @dev Get optimal path for swapping WHBAR to tokenOut
     * @param tokenOut Target token address
     * @return path Array of token addresses for optimal swap route
     */
    function _getOptimalPath(address tokenOut) internal view returns (address[] memory path) {
        require(tokenOut != address(0), "Invalid tokenOut address");
        require(tokenOut != WHBAR_FOR_PATH, "Cannot swap WHBAR to WHBAR");
        
        // USDC tiene path directo con WHBAR
        if (tokenOut == USDC) {
            path = new address[](2);
            path[0] = WHBAR_FOR_PATH; // WHBAR address correcta (0x0000000000000000000000000000000000003aD2)
            path[1] = tokenOut;       // USDC directly
            return path;
        }
        
        // Para SAUCE y otros tokens, usar multi-hop a través de USDC
        // Path: WHBAR -> USDC -> TOKEN (este es el path correcto según el error)
        path = new address[](3);
        path[0] = WHBAR_FOR_PATH; // WHBAR address correcta (0x0000000000000000000000000000000000003aD2)
        path[1] = USDC;           // USDC como intermediario (0x00000000000000000000000000000000000014F5)
        path[2] = tokenOut;       // Target token (0x0000000000000000000000000000000000120f46)
        
        return path;
    }
    
    /**
     * @dev Check if order amount is within router V1 limits
     * @param amount Amount in tinybars to check
     * @return bool Whether amount is within limits
     */
    function _isWithinRouterV1Limits(uint256 amount) internal pure returns (bool) {
        return amount <= ROUTER_THRESHOLD;
    }
    
    /**
     * @dev Get router threshold in HBAR (for display purposes)
     * @return Router threshold in HBAR
     */
    function getRouterThresholdHBAR() external pure returns (uint256) {
        return ROUTER_THRESHOLD / 100000000; // Convert tinybars to HBAR
    }
    
    /**
     * @dev Update execution fee (owner only)
     * @param newFee New execution fee
     */
    function updateExecutionFee(uint256 newFee) external onlyOwner {
        require(newFee > 0, "Fee must be greater than 0");
        require(newFee <= 1000000000, "Fee too high: max 10 HBAR"); // Max 10 HBAR
        uint256 oldFee = executionFee;
        executionFee = newFee;
        emit ExecutionFeeUpdated(oldFee, newFee);
    }
    
    /**
     * @dev Withdraw accumulated fees (owner only)
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        payable(owner()).transfer(balance);
    }
    
    /**
     * @dev Function to receive HBAR directly
     */
    receive() external payable {
        // Allow receiving HBAR for orders and fees
    }
    
    /**
     * @dev Get total contract balance
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Get contract configuration
     */
    function getContractConfig() external view returns (
        uint256 currentExecutionFee,
        uint256 minOrderAmount,
        address currentBackendExecutor,
        uint256 currentNextOrderId,
        uint256 routerThreshold,
        address whbarAddress
    ) {
        return (
            executionFee, 
            MIN_ORDER_AMOUNT, 
            backendExecutor, 
            nextOrderId,
            ROUTER_THRESHOLD,
            WETH
        );
    }
    
    /**
     * @dev Get execution configuration
     */
    function getExecutionConfig() external view returns (
        bool publicExecutionEnabled_,
        uint256 authorizedExecutorCount,
        address backendExecutor_
    ) {
        return (publicExecutionEnabled, executorList.length, backendExecutor);
    }
    
    /**
     * @dev Get minimum total HBAR needed to create an order
     */
    function getMinimumHbarForOrder() external view returns (uint256) {
        return executionFee + MIN_ORDER_AMOUNT;
    }
    
    /**
     * @dev Check if an order exists and is valid
     */
    function isValidOrder(uint256 orderId) public view returns (bool) {
        return orderId > 0 && orderId < nextOrderId && swapOrders[orderId].owner != address(0);
    }
    
    /**
     * @dev Get count of orders for a user
     */
    function getUserOrderCount(address user) external view returns (uint256) {
        return userOrders[user].length;
    }
    
    /**
     * @dev Check if an order can be executed with current router setup
     * @param orderId Order ID to check
     * @return canExecute Whether order can be executed
     * @return reason Reason if cannot execute
     */
    function canExecuteOrder(uint256 orderId) external view returns (bool canExecute, string memory reason) {
        if (!isValidOrder(orderId)) {
            return (false, "Invalid order ID");
        }
        
        SwapOrder storage order = swapOrders[orderId];
        
        if (!order.isActive) {
            return (false, "Order not active");
        }
        
        if (order.isExecuted) {
            return (false, "Order already executed");
        }
        
        if (block.timestamp >= order.expirationTime) {
            return (false, "Order expired");
        }
        
        if (!_isWithinRouterV1Limits(order.amountIn)) {
            return (false, "Order amount exceeds router V1 limit (>180 HBAR)");
        }
        
        return (true, "Order can be executed");
    }
    
    /**
     * @dev Get router information for debugging
     */
    function getRouterInfo() external view returns (
        address routerAddress,
        address whbarFromRouter,
        address factoryAddress,
        uint256 thresholdTinybars,
        uint256 thresholdHBAR
    ) {
        return (
            address(saucerSwapRouter),
            saucerSwapRouter.WHBAR(),
            saucerSwapRouter.factory(),
            ROUTER_THRESHOLD,
            ROUTER_THRESHOLD / 100000000
        );
    }
    
    /**
     * @dev Get available token addresses for swapping
     */
    function getAvailableTokens() external pure returns (
        address usdcAddress,
        string memory usdcInfo,
        address sauceAddress,
        string memory sauceInfo
    ) {
        return (
            USDC,
            "USDC Testnet (0.0.5349) - Direct WHBAR pair available",
            SAUCE,
            "SAUCE Testnet (0.0.1183558) - Multi-hop via USDC"
        );
    }
    
    /**
     * @dev Get list of all supported tokens
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }
    
    /**
     * @dev Get count of supported tokens
     */
    function getSupportedTokenCount() external view returns (uint256) {
        return supportedTokens.length;
    }
    
    /**
     * @dev Check if a token is supported
     */
    function isTokenSupported(address token) external view returns (bool) {
        return isSupportedToken[token];
    }
    
    /**
     * @dev Get optimal path preview for a token (for debugging)
     * @param tokenOut Target token address
     * @return path Array of addresses in the swap path
     * @return pathInfo Description of the path
     */
    function getOptimalPathPreview(address tokenOut) external view returns (
        address[] memory path,
        string memory pathInfo
    ) {
        path = _getOptimalPath(tokenOut);
        
        if (path.length == 2) {
            pathInfo = "Direct path: WHBAR -> Target Token";
        } else if (path.length == 3) {
            pathInfo = "Multi-hop path: WHBAR -> USDC -> Target Token";
        } else {
            pathInfo = "Unknown path configuration";
        }
        
        return (path, pathInfo);
    }
}