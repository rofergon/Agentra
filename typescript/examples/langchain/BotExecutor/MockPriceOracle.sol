// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockPriceOracle
 * @dev Mock price oracle for testing AutoSwapLimit contract
 * Provides price feeds for HBAR and SAUCE tokens in USDC terms
 * Prices are manually set by owner for testing purposes
 */
contract MockPriceOracle is Ownable {
    
    // Price precision: 8 decimals (similar to Chainlink)
    uint256 public constant PRICE_DECIMALS = 8;
    uint256 public constant PRICE_PRECISION = 10**PRICE_DECIMALS;
    
    // Price data structure
    struct PriceData {
        uint256 price;          // Price in USDC terms with 8 decimals
        uint256 lastUpdated;    // Timestamp of last update
        bool isActive;          // Whether this price feed is active
    }
    
    // Token addresses (Hedera Testnet)
    address public constant HBAR_ADDRESS = 0x0000000000000000000000000000000000000000; // Native HBAR
    address public constant WHBAR_ADDRESS = 0x0000000000000000000000000000000000003aD2; // WHBAR (0.0.14802)
    address public constant USDC_ADDRESS = 0x00000000000000000000000000000000000014F5; // USDC (0.0.5349)
    address public constant SAUCE_ADDRESS = 0x0000000000000000000000000000000000120f46; // SAUCE (0.0.1183558)
    
    // Price feeds mapping: token address => price data
    mapping(address => PriceData) public priceFeeds;
    
    // Supported tokens array
    address[] public supportedTokens;
    mapping(address => bool) public isSupportedToken;
    
    // Maximum price age (24 hours)
    uint256 public constant MAX_PRICE_AGE = 24 hours;
    
    // Price update tolerance (10% max change per update)
    uint256 public constant MAX_PRICE_CHANGE_PERCENT = 10;
    
    // Events
    event PriceUpdated(
        address indexed token,
        uint256 oldPrice,
        uint256 newPrice,
        uint256 timestamp
    );
    
    event TokenAdded(address indexed token, uint256 initialPrice);
    event TokenRemoved(address indexed token);
    event PriceFeedActivated(address indexed token);
    event PriceFeedDeactivated(address indexed token);
    
    constructor() Ownable(msg.sender) {
        // Initialize with default prices (in USDC with 8 decimals)
        _initializeDefaultPrices();
    }
    
    /**
     * @dev Initialize default prices for main tokens
     */
    function _initializeDefaultPrices() private {
        // HBAR = $0.27 USD (27 * 10^6 = 27000000 with 8 decimals)
        _addToken(HBAR_ADDRESS, 27000000);
        _addToken(WHBAR_ADDRESS, 27000000); // Same as HBAR
        
        // SAUCE = $0.0587 USD (587 * 10^4 = 5870000 with 8 decimals)
        _addToken(SAUCE_ADDRESS, 5870000);
        
        // USDC = $1.00 USD (reference price)
        _addToken(USDC_ADDRESS, 100000000); // 1.00000000
    }
    
    /**
     * @dev Add a new token to price feeds
     * @param token Token address
     * @param initialPrice Initial price in USDC terms (8 decimals)
     */
    function _addToken(address token, uint256 initialPrice) private {
        require(initialPrice > 0, "Price must be greater than 0");
        
        if (!isSupportedToken[token]) {
            supportedTokens.push(token);
            isSupportedToken[token] = true;
        }
        
        priceFeeds[token] = PriceData({
            price: initialPrice,
            lastUpdated: block.timestamp,
            isActive: true
        });
        
        emit TokenAdded(token, initialPrice);
        emit PriceUpdated(token, 0, initialPrice, block.timestamp);
    }
    
    /**
     * @dev Update price for a token (owner only)
     * @param token Token address
     * @param newPrice New price in USDC terms (8 decimals)
     */
    function updatePrice(address token, uint256 newPrice) external onlyOwner {
        require(isSupportedToken[token], "Token not supported");
        require(newPrice > 0, "Price must be greater than 0");
        
        PriceData storage priceData = priceFeeds[token];
        require(priceData.isActive, "Price feed not active");
        
        // Validate price change is reasonable (optional safety check)
        if (priceData.price > 0) {
            uint256 priceChange = newPrice > priceData.price 
                ? ((newPrice - priceData.price) * 100) / priceData.price
                : ((priceData.price - newPrice) * 100) / priceData.price;
                
            require(priceChange <= MAX_PRICE_CHANGE_PERCENT * 10, "Price change too large"); // 10x for extreme testing
        }
        
        uint256 oldPrice = priceData.price;
        priceData.price = newPrice;
        priceData.lastUpdated = block.timestamp;
        
        emit PriceUpdated(token, oldPrice, newPrice, block.timestamp);
    }
    
    /**
     * @dev Update multiple prices at once (owner only)
     * @param tokens Array of token addresses
     * @param prices Array of new prices
     */
    function updatePrices(address[] calldata tokens, uint256[] calldata prices) external onlyOwner {
        require(tokens.length == prices.length, "Arrays length mismatch");
        require(tokens.length > 0, "Empty arrays");
        
        for (uint256 i = 0; i < tokens.length; i++) {
            if (isSupportedToken[tokens[i]] && prices[i] > 0) {
                PriceData storage priceData = priceFeeds[tokens[i]];
                if (priceData.isActive) {
                    uint256 oldPrice = priceData.price;
                    priceData.price = prices[i];
                    priceData.lastUpdated = block.timestamp;
                    
                    emit PriceUpdated(tokens[i], oldPrice, prices[i], block.timestamp);
                }
            }
        }
    }
    
    /**
     * @dev Get current price for a token
     * @param token Token address
     * @return price Current price in USDC terms (8 decimals)
     * @return lastUpdated Timestamp of last update
     */
    function getPrice(address token) external view returns (uint256 price, uint256 lastUpdated) {
        require(isSupportedToken[token], "Token not supported");
        
        PriceData memory priceData = priceFeeds[token];
        require(priceData.isActive, "Price feed not active");
        require(priceData.lastUpdated > 0, "Price never set");
        
        return (priceData.price, priceData.lastUpdated);
    }
    
    /**
     * @dev Get latest price (compatible with Chainlink-style interface)
     * @param token Token address
     * @return price Latest price
     */
    function latestPrice(address token) external view returns (uint256 price) {
        (price, ) = this.getPrice(token);
        return price;
    }
    
    /**
     * @dev Check if price is fresh (within MAX_PRICE_AGE)
     * @param token Token address
     * @return isFresh Whether price is fresh
     */
    function isPriceFresh(address token) external view returns (bool isFresh) {
        require(isSupportedToken[token], "Token not supported");
        
        PriceData memory priceData = priceFeeds[token];
        return priceData.isActive && 
               priceData.lastUpdated > 0 && 
               (block.timestamp - priceData.lastUpdated) <= MAX_PRICE_AGE;
    }
    
    /**
     * @dev Get price age in seconds
     * @param token Token address
     * @return age Age of price in seconds
     */
    function getPriceAge(address token) external view returns (uint256 age) {
        require(isSupportedToken[token], "Token not supported");
        
        PriceData memory priceData = priceFeeds[token];
        require(priceData.lastUpdated > 0, "Price never set");
        
        return block.timestamp - priceData.lastUpdated;
    }
    
    /**
     * @dev Add a new token to the oracle (owner only)
     * @param token Token address
     * @param initialPrice Initial price in USDC terms (8 decimals)
     */
    function addToken(address token, uint256 initialPrice) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(!isSupportedToken[token], "Token already supported");
        _addToken(token, initialPrice);
    }
    
    /**
     * @dev Remove a token from the oracle (owner only)
     * @param token Token address
     */
    function removeToken(address token) external onlyOwner {
        require(isSupportedToken[token], "Token not supported");
        require(token != USDC_ADDRESS, "Cannot remove USDC reference");
        
        isSupportedToken[token] = false;
        priceFeeds[token].isActive = false;
        
        // Remove from array
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            if (supportedTokens[i] == token) {
                supportedTokens[i] = supportedTokens[supportedTokens.length - 1];
                supportedTokens.pop();
                break;
            }
        }
        
        emit TokenRemoved(token);
    }
    
    /**
     * @dev Activate/deactivate a price feed (owner only)
     * @param token Token address
     * @param active Whether to activate or deactivate
     */
    function setPriceFeedActive(address token, bool active) external onlyOwner {
        require(isSupportedToken[token], "Token not supported");
        
        priceFeeds[token].isActive = active;
        
        if (active) {
            emit PriceFeedActivated(token);
        } else {
            emit PriceFeedDeactivated(token);
        }
    }
    
    /**
     * @dev Get all supported tokens
     * @return Array of supported token addresses
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }
    
    /**
     * @dev Get number of supported tokens
     * @return count Number of supported tokens
     */
    function getSupportedTokenCount() external view returns (uint256 count) {
        return supportedTokens.length;
    }
    
    /**
     * @dev Get complete price data for a token
     * @param token Token address
     * @return priceData Complete price data struct
     */
    function getPriceData(address token) external view returns (PriceData memory priceData) {
        require(isSupportedToken[token], "Token not supported");
        return priceFeeds[token];
    }
    
    /**
     * @dev Get oracle configuration
     * @return decimals Price decimals
     * @return precision Price precision
     * @return maxAge Maximum price age
     * @return maxChangePercent Maximum price change percent
     */
    function getOracleConfig() external pure returns (
        uint256 decimals,
        uint256 precision,
        uint256 maxAge,
        uint256 maxChangePercent
    ) {
        return (PRICE_DECIMALS, PRICE_PRECISION, MAX_PRICE_AGE, MAX_PRICE_CHANGE_PERCENT);
    }
    
    /**
     * @dev Convert price to human readable format
     * @param price Price with 8 decimals
     * @return humanPrice Price as string with proper decimals
     */
    function formatPrice(uint256 price) external pure returns (string memory humanPrice) {
        uint256 dollars = price / PRICE_PRECISION;
        uint256 cents = (price % PRICE_PRECISION) / (PRICE_PRECISION / 100);
        
        return string(abi.encodePacked(
            _toString(dollars),
            ".",
            cents < 10 ? "0" : "",
            _toString(cents),
            " USDC"
        ));
    }
    
    /**
     * @dev Helper function to convert uint to string
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
    
    /**
     * @dev Emergency function to reset all prices (owner only)
     */
    function resetPrices() external onlyOwner {
        // Reset to default prices
        priceFeeds[HBAR_ADDRESS].price = 27000000; // $0.27
        priceFeeds[WHBAR_ADDRESS].price = 27000000; // $0.27
        priceFeeds[SAUCE_ADDRESS].price = 5870000; // $0.0587
        priceFeeds[USDC_ADDRESS].price = 100000000; // $1.00
        
        // Update timestamps
        uint256 currentTime = block.timestamp;
        priceFeeds[HBAR_ADDRESS].lastUpdated = currentTime;
        priceFeeds[WHBAR_ADDRESS].lastUpdated = currentTime;
        priceFeeds[SAUCE_ADDRESS].lastUpdated = currentTime;
        priceFeeds[USDC_ADDRESS].lastUpdated = currentTime;
        
        emit PriceUpdated(HBAR_ADDRESS, 0, 27000000, currentTime);
        emit PriceUpdated(WHBAR_ADDRESS, 0, 27000000, currentTime);
        emit PriceUpdated(SAUCE_ADDRESS, 0, 5870000, currentTime);
        emit PriceUpdated(USDC_ADDRESS, 0, 100000000, currentTime);
    }
}