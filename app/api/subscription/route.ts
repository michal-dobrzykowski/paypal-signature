// getOrCreateProduct

import { PayPalSingleton } from "@/components/helpers/paypal-singleton";

export const POST = async (req: Request) => {
  const body = await req.json();
  console.log("CREATE SUBSCRIPTION", body);

  const PayPal = new PayPalSingleton();

  try {
    const product = (await PayPal.getOrCreateProduct()) as any;
    console.log("product", product);

    if (!product || !product.id) {
      throw new Error("Product not found or created");
    }

    // TODO: get existing billing plan if products are the same (create table with subscription billing map. you can do this by creating code like sort by id and iterate adding "O"+ number for one time and "R"+number for recurring. then you can check if the same pattern exists) e.g. O1:prod_variant_00001,R1:prod_variant_00002  etc.

    // TODO: save new billing plans to this table

    const billingPlan = (await PayPal.createBillingPlan({
      productId: product.id,
      name: "Order fee",
      currency: "EUR",
      //   oneTimeAmount: null,
      oneTimeAmount: 30,
      recurringAmount: 50,
    })) as any;

    console.log("billingPlan", billingPlan);

    if (!billingPlan || !billingPlan.id) {
      throw new Error("Billing plan not found or created");
    }

    const data = await PayPal.createSubscription(
      billingPlan.id,
      "TEST-SUBSCRIPTION-ID-123"
    );
    console.log("data", data);

    return new Response(JSON.stringify(data), {
      status: 201,
    });
  } catch (err) {
    console.log("err", err);

    return new Response(JSON.stringify(err), {
      status: 500,
    });
  }
};
