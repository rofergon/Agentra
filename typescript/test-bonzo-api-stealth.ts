/**
 * Stealth test script for Bonzo Finance API endpoints
 * Uses browser-like headers and timing to avoid bot detection
 */

const BONZO_API_BASE = 'https://bonzo-data-api-eceac9d8a2aa.herokuapp.com';

// More realistic browser headers to avoid bot detection
const getBrowserHeaders = () => ({
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://bonzo.finance/',
  'Origin': 'https://bonzo.finance',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'cross-site'
});

// Test endpoints one by one with longer delays
const TEST_ENDPOINTS = [
  {
    name: 'Market Information',
    endpoint: '/market',
    description: 'Get current global state of all Bonzo liquidity pools'
  },
  {
    name: 'Protocol Information', 
    endpoint: '/info',
    description: 'Get server and protocol configuration information'
  },
  {
    name: 'BONZO Token Information',
    endpoint: '/bonzo',
    description: 'Get circulation information for the BONZO token'
  }
];

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testSingleEndpoint(endpoint: string, name: string): Promise<any> {
  const url = `${BONZO_API_BASE}${endpoint}`;
  
  console.log(`\n🔍 Testing: ${name}`);
  console.log(`📡 URL: ${url}`);
  
  try {
    // Add random delay between 2-5 seconds to seem more human
    const randomDelay = 2000 + Math.random() * 3000;
    console.log(`⏳ Waiting ${Math.round(randomDelay)}ms...`);
    await delay(randomDelay);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getBrowserHeaders()
    });
    
    console.log(`📊 Response: ${response.status} ${response.statusText}`);
    console.log(`🏷️  Content-Type: ${response.headers.get('content-type')}`);
    
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      
      if (endpoint === '/bonzo/circulation') {
        const data = await response.text();
        console.log(`✅ Success! Data: ${data}`);
        return { success: true, data: data };
      } else if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        console.log(`✅ Success! Keys: ${Object.keys(data).join(', ')}`);
        
        // Show a preview of the data structure
        if (data.reserves && Array.isArray(data.reserves)) {
          console.log(`📈 Found ${data.reserves.length} reserves`);
          if (data.reserves.length > 0) {
            console.log(`🪙 First token: ${data.reserves[0].symbol || data.reserves[0].name || 'Unknown'}`);
          }
        }
        
        return { success: true, data: data };
      } else {
        const data = await response.text();
        console.log(`✅ Success! Text data: ${data.substring(0, 200)}...`);
        return { success: true, data: data };
      }
    } else {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = 'Could not read error response';
      }
      
      console.log(`❌ Failed! Error: ${errorText}`);
      return { 
        success: false, 
        status: response.status, 
        error: errorText,
        headers: Object.fromEntries(response.headers.entries())
      };
    }
    
  } catch (error) {
    console.log(`💥 Network Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

async function runStealthTest() {
  console.log('🕵️ Starting Stealth Bonzo API Test...');
  console.log(`🎯 Target: ${BONZO_API_BASE}`);
  console.log(`🕐 Time: ${new Date().toISOString()}`);
  console.log('🤖 Simulating human browsing patterns...\n');
  
  const results: any[] = [];
  
  for (const config of TEST_ENDPOINTS) {
    const result = await testSingleEndpoint(config.endpoint, config.name);
    results.push({
      name: config.name,
      endpoint: config.endpoint,
      ...result
    });
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 STEALTH TEST SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n✅ Successful: ${successful.length}/${results.length}`);
  if (successful.length > 0) {
    successful.forEach(r => console.log(`   • ${r.name}`));
  }
  
  console.log(`\n❌ Failed: ${failed.length}/${results.length}`);
  if (failed.length > 0) {
    failed.forEach(r => {
      console.log(`   • ${r.name}: HTTP ${r.status || 'N/A'} - ${r.error || 'Unknown error'}`);
    });
  }
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  if (failed.length === results.length) {
    console.log('   🚫 All endpoints blocked - possible IP ban or API changes');
    console.log('   🔄 Try again later or from different network');
    console.log('   📧 Contact Bonzo Finance for API access requirements');
  } else if (failed.length > 0) {
    console.log('   ⚡ Some endpoints working - adjust rate limiting');
    console.log('   🕐 Increase delays between requests');
  } else {
    console.log('   🎉 All endpoints working - stealth approach successful!');
  }
  
  return results;
}

// Export for use in other modules
export { runStealthTest, testSingleEndpoint };

// Run if called directly
runStealthTest().catch(console.error); 