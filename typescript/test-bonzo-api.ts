/**
 * Test script for Bonzo Finance API endpoints
 * Tests all available endpoints and reports their status
 */

const BONZO_API_BASE = 'https://bonzo-data-api-eceac9d8a2aa.herokuapp.com';

// Test endpoints configuration
const TEST_ENDPOINTS = [
  {
    name: 'Market Information',
    endpoint: '/market',
    method: 'GET',
    requiresParams: false,
    description: 'Get current global state of all Bonzo liquidity pools'
  },
  {
    name: 'Protocol Information', 
    endpoint: '/info',
    method: 'GET',
    requiresParams: false,
    description: 'Get server and protocol configuration information'
  },
  {
    name: 'BONZO Token Information',
    endpoint: '/bonzo',
    method: 'GET', 
    requiresParams: false,
    description: 'Get circulation information for the BONZO token'
  },
  {
    name: 'BONZO Circulation Supply',
    endpoint: '/bonzo/circulation',
    method: 'GET',
    requiresParams: false,
    description: 'Get current circulating supply as plain number'
  },
  {
    name: 'Pool Statistics',
    endpoint: '/stats',
    method: 'GET',
    requiresParams: false,
    description: 'Get 24-hour protocol statistics'
  },
  {
    name: 'Account Dashboard (Test Account)',
    endpoint: '/dashboard/0.0.123456',
    method: 'GET',
    requiresParams: true,
    description: 'Get account lending/borrowing positions (using test account)'
  }
];

interface TestResult {
  name: string;
  endpoint: string;
  status: 'SUCCESS' | 'ERROR' | 'NOT_FOUND' | 'SERVER_ERROR';
  httpStatus?: number;
  responseTime: number;
  responseSize?: number;
  error?: string;
  data?: any;
}

async function testEndpoint(config: typeof TEST_ENDPOINTS[0]): Promise<TestResult> {
  const startTime = Date.now();
  const url = `${BONZO_API_BASE}${config.endpoint}`;
  
  try {
    console.log(`🔍 Testing: ${config.name}`);
    console.log(`   URL: ${url}`);
    
    const response = await fetch(url, {
      method: config.method,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Bonzo-API-Tester/1.0'
      }
    });
    
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      let data;
      let responseSize = 0;
      
      if (config.endpoint === '/bonzo/circulation') {
        // This endpoint returns plain text
        data = await response.text();
        responseSize = data.length;
      } else if (contentType && contentType.includes('application/json')) {
        data = await response.json();
        responseSize = JSON.stringify(data).length;
      } else {
        data = await response.text();
        responseSize = data.length;
      }
      
      return {
        name: config.name,
        endpoint: config.endpoint,
        status: 'SUCCESS',
        httpStatus: response.status,
        responseTime,
        responseSize,
        data: typeof data === 'object' ? Object.keys(data).length + ' keys' : data.toString().substring(0, 100)
      };
    } else {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = 'Could not read error response';
      }
      
      return {
        name: config.name,
        endpoint: config.endpoint,
        status: response.status === 404 ? 'NOT_FOUND' : 'SERVER_ERROR',
        httpStatus: response.status,
        responseTime,
        error: errorText
      };
    }
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      name: config.name,
      endpoint: config.endpoint,
      status: 'ERROR',
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function printResults(results: TestResult[]) {
  console.log('\n🧪 BONZO API TEST RESULTS');
  console.log('=' .repeat(80));
  
  const successCount = results.filter(r => r.status === 'SUCCESS').length;
  const totalCount = results.length;
  
  console.log(`\n📊 Summary: ${successCount}/${totalCount} endpoints working`);
  console.log(`🟢 Success Rate: ${((successCount / totalCount) * 100).toFixed(1)}%\n`);
  
  results.forEach((result, index) => {
    const statusEmoji = {
      'SUCCESS': '✅',
      'ERROR': '❌', 
      'NOT_FOUND': '⚠️',
      'SERVER_ERROR': '🔴'
    }[result.status];
    
    console.log(`${index + 1}. ${statusEmoji} ${result.name}`);
    console.log(`   Endpoint: ${result.endpoint}`);
    console.log(`   Status: ${result.status} (HTTP ${result.httpStatus || 'N/A'})`);
    console.log(`   Response Time: ${result.responseTime}ms`);
    
    if (result.responseSize) {
      console.log(`   Response Size: ${result.responseSize} bytes`);
    }
    
    if (result.status === 'SUCCESS' && result.data) {
      console.log(`   Data Preview: ${result.data}`);
    }
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    console.log('');
  });
}

function printDetailedAnalysis(results: TestResult[]) {
  console.log('🔍 DETAILED ANALYSIS');
  console.log('=' .repeat(50));
  
  // Working endpoints
  const working = results.filter(r => r.status === 'SUCCESS');
  if (working.length > 0) {
    console.log('\n✅ WORKING ENDPOINTS:');
    working.forEach(r => {
      console.log(`   • ${r.name} (${r.responseTime}ms)`);
    });
  }
  
  // Broken endpoints
  const broken = results.filter(r => r.status !== 'SUCCESS');
  if (broken.length > 0) {
    console.log('\n❌ BROKEN ENDPOINTS:');
    broken.forEach(r => {
      console.log(`   • ${r.name}: ${r.status} - ${r.error || 'HTTP ' + r.httpStatus}`);
    });
  }
  
  // Performance analysis
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  console.log(`\n⚡ Average Response Time: ${avgResponseTime.toFixed(0)}ms`);
  
  const slowEndpoints = results.filter(r => r.responseTime > 2000);
  if (slowEndpoints.length > 0) {
    console.log('\n🐌 SLOW ENDPOINTS (>2s):');
    slowEndpoints.forEach(r => {
      console.log(`   • ${r.name}: ${r.responseTime}ms`);
    });
  }
}

async function runBonzoApiTests() {
  console.log('🚀 Starting Bonzo Finance API Tests...');
  console.log(`📡 Testing API: ${BONZO_API_BASE}`);
  console.log(`📅 Test Time: ${new Date().toISOString()}\n`);
  
  const results: TestResult[] = [];
  
  // Test each endpoint
  for (const config of TEST_ENDPOINTS) {
    const result = await testEndpoint(config);
    results.push(result);
    
    // Small delay between requests to be respectful
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Print results
  printResults(results);
  printDetailedAnalysis(results);
  
  console.log('\n🏁 Tests completed!');
  console.log('💡 Tip: Update the tool implementation based on these results');
  
  return results;
}

// Run the tests immediately
runBonzoApiTests().catch(console.error);

export { runBonzoApiTests, TEST_ENDPOINTS }; 