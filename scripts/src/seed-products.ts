import { getUncachableStripeClient } from './stripeClient';

async function createProducts() {
  try {
    const stripe = await getUncachableStripeClient();
    console.log('Creating Intermingled subscription products in Stripe...');

    // Check if Suitor plan already exists
    const existingSuitor = await stripe.products.search({
      query: "name:'Suitor Plan' AND active:'true'"
    });

    if (existingSuitor.data.length === 0) {
      const suitorProduct = await stripe.products.create({
        name: 'Suitor Plan',
        description: 'Join the suitor pool and be chosen by a chooser.',
        metadata: { role: 'suitor' },
      });
      const suitorPrice = await stripe.prices.create({
        product: suitorProduct.id,
        unit_amount: 899,
        currency: 'usd',
        recurring: { interval: 'month' },
      });
      console.log(`✓ Created Suitor Plan: ${suitorProduct.id} / ${suitorPrice.id} ($8.99/mo)`);
    } else {
      console.log('Suitor Plan already exists, skipping.');
    }

    // Check if Chooser plan already exists
    const existingChooser = await stripe.products.search({
      query: "name:'Chooser Plan' AND active:'true'"
    });

    if (existingChooser.data.length === 0) {
      const chooserProduct = await stripe.products.create({
        name: 'Chooser Plan',
        description: 'Be the chooser — review suitors and pick your match.',
        metadata: { role: 'chooser' },
      });
      const chooserPrice = await stripe.prices.create({
        product: chooserProduct.id,
        unit_amount: 1299,
        currency: 'usd',
        recurring: { interval: 'month' },
      });
      console.log(`✓ Created Chooser Plan: ${chooserProduct.id} / ${chooserPrice.id} ($12.99/mo)`);
    } else {
      console.log('Chooser Plan already exists, skipping.');
    }

    console.log('\n✓ Done! Webhooks will sync this data to your database automatically.');
  } catch (error: any) {
    console.error('Error creating products:', error.message);
    process.exit(1);
  }
}

createProducts();
