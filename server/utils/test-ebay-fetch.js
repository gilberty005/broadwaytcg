const { fetchEbaySoldPrices, fetchCollectionEbayPrices } = require('./ebay');

async function testEbayFetch() {
  try {
    console.log('Testing eBay price fetching...');
    
    // Test with a specific card
    const searchOptions = {
      name: 'Charizard VMAX',
      set: 'Shining Fates'
    };
    console.log(`Searching for: "${searchOptions.name} ${searchOptions.set}"`);
    
    const prices = await fetchEbaySoldPrices(searchOptions);
    
    if (prices && prices.length > 0) {
      console.log(`\nFound ${prices.length} lowest prices in the last 90 days:`);
      prices.forEach((item, index) => {
        console.log(`\n${index + 1}. $${item.price} ${item.currency}`);
        console.log(`   Title: ${item.title}`);
        console.log(`   Date: ${item.soldDate}`);
        console.log(`   Condition: ${item.condition || 'N/A'}`);
        console.log(`   URL: ${item.itemWebUrl}`);
      });
      
      // Calculate mean price
      const meanPrice = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;
      console.log(`\nMean price: $${meanPrice.toFixed(2)}`);
    } else {
      console.log('No prices found for this search term.');
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

async function testCollectionFetch() {
  try {
    console.log('\n\nTesting collection price fetching...');
    
    // Test with a user ID (you'll need to replace with a real user ID)
    const userId = 1; // Replace with actual user ID from your database
    console.log(`Fetching prices for user ${userId}'s collection...`);
    
    const collectionPrices = await fetchCollectionEbayPrices(userId);
    
    if (collectionPrices && collectionPrices.length > 0) {
      console.log(`\nFound prices for ${collectionPrices.length} products:`);
      collectionPrices.forEach((item, index) => {
        console.log(`\n${index + 1}. ${item.name} ${item.set_name}`);
        console.log(`   Mean Price: $${item.mean_price}`);
        console.log(`   Price Count: ${item.price_count}`);
        console.log(`   Grading: ${item.grading_company && item.grade ? `${item.grading_company} ${item.grade}` : 'Raw'}`);
      });
    } else {
      console.log('No products found in collection or no prices available.');
    }
  } catch (error) {
    console.error('Collection test failed:', error.message);
  }
}

// Run both tests
async function runTests() {
  await testEbayFetch();
  await testCollectionFetch();
}

runTests(); 