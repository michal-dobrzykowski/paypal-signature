// const { CLIENT_ID, APP_SECRET } = process.env;
import "dotenv/config";
import express from "express";
// import crypto from "crypto";
// import crc32 from "buffer-crc32";
// import fs from "fs/promises";
import fetch from "node-fetch";
import { v4 as uuidv4 } from "uuid";

const app = express();

const {
  PAYPAL_SANDBOX,
  PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  PAYPAL_AUTH_WEBHOOK_ID,
  LISTEN_PORT = 8888,
  //   CACHE_DIR = ".",
  //   PAYPAL_AUTH_WEBHOOK_ID = "<from when the listener URL was subscribed>",
} = process.env;

class PayPalSingleton {
  constructor() {
    if (PayPalSingleton.exists) {
      return PayPalSingleton.instance;
    }

    this.baseUrl =
      PAYPAL_SANDBOX === "true"
        ? "https://api-m.sandbox.paypal.com"
        : "https://api-m.paypal.com";

    this.accessToken = null;
    this.productId = "subscription-product-id-1";

    PayPalSingleton.exists = true;
    PayPalSingleton.instance = this;

    return this;
  }

  async createAccessToken() {
    const auth = Buffer.from(
      PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET
    ).toString("base64");

    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      body: "grant_type=client_credentials",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    const data = await response.json();

    this.accessToken = data.access_token;
    return this.accessToken;
  }

  async getAccessToken() {
    if (this.accessToken) {
      return this.accessToken;
    }
    return this.createAccessToken();
  }

  async postRequest(url, body, defaultErrorMessage) {
    await this.getAccessToken();

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      if (res.status === 401) {
        await this.createAccessToken();
        return this.postRequest(url, body, defaultErrorMessage);
      }

      const errorData = await res.json();
      throw new Error(errorData.error_description || defaultErrorMessage);
    }

    const data = await res.json();
    return data;
  }

  async getRequest(url, defaultErrorMessage) {
    await this.getAccessToken();

    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        await this.createAccessToken();
        return this.getRequest(url, defaultErrorMessage);
      }

      const errorData = await res.json();
      throw new Error(errorData.error_description || defaultErrorMessage);
    }

    const data = await res.json();
    return data;
  }

  //   DONE: TO TEST

  // https://developer.paypal.com/docs/api/catalog-products/v1/
  async createProduct() {
    return this.postRequest(
      `${this.baseUrl}/v1/catalogs/products`,
      {
        name: "Order Fee",
        type: "PHYSICAL",
        id: this.productId,
      },
      "Failed to create product"
    );
  }

  async getProductById(id) {
    return this.getRequest(
      `${this.baseUrl}/v1/catalogs/products/${id}`,
      "Failed to get product"
    );
  }

  async verifyWebhook(headers, body) {
    const data = await this.postRequest(
      `${this.baseUrl}/v1/notifications/verify-webhook-signature`,
      {
        transmission_id: headers["paypal-transmission-id"],
        transmission_time: headers["paypal-transmission-time"],
        cert_url: headers["paypal-cert-url"],
        auth_algo: headers["paypal-auth-algo"],
        transmission_sig: headers["paypal-transmission-sig"],
        webhook_id: PAYPAL_AUTH_WEBHOOK_ID,
        webhook_event: body,
      },
      "Failed to verify webhook signature"
    );

    return data.verification_status === "SUCCESS";
  }

  async getOrCreateProduct() {
    try {
      const product = await this.getProductById(this.productId);

      return product;
    } catch (error) {
      const newProduct = await this.createProduct();

      return newProduct;
    }
  }

  async createBillingPlan({
    productId = this.productId,
    name,
    currency = "USD",
    oneTimeAmount = null,
    recurringAmount,
  }) {
    // https://developer.paypal.com/docs/api/subscriptions/v1/
    let description = `Recurring payment of ${recurringAmount} ${currency} per month`;
    let setup_fee = {};

    if (oneTimeAmount) {
      setup_fee = {
        value: oneTimeAmount,
        currency_code: currency,
      };
      description += ` and one-time payment of ${oneTimeAmount} ${currency}`;
    }

    const billingPlanData = {
      product_id: productId,
      name,
      description,
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: {
            interval_unit: "MONTH",
            interval_count: 1,
          },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: {
              value: recurringAmount,
              currency_code: currency,
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee,
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 3,
      },
      //   taxes: {
      //     percentage: "10",
      //     inclusive: false,
      //   },
    };

    return this.postRequest(
      `${this.baseUrl}/v1/billing/plans`,
      billingPlanData,
      "Failed to create billing plan"
    );
  }

  async updateBillingPlanPricing(billingPlanId, currency, newReccuringAmount) {
    return this.postRequest(
      `${this.baseUrl}/v1/billing/plans/${billingPlanId}/update-pricing-schemes`,
      {
        pricing_schemes: [
          {
            billing_cycle_sequence: 1,
            pricing_scheme: {
              fixed_price: {
                value: newReccuringAmount,
                currency_code: currency,
              },
            },
          },
        ],
      },
      "Failed to update billing pricing plan"
    );
  }

  getTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString();
  }

  //   TODO: check if needed for integration
  async createSubscription(billingPlanId) {
    await this.getAccessToken();

    const tomorrow = this.getTomorrow();

    const subscriptionData = {};

    return this.postRequest(
      `${this.baseUrl}/v1/billing/subscriptions`,
      subscriptionData,
      "Failed to create subscription"
    );

    // {
    //     "plan_id": "{{billing_plan_id}}",
    //     "start_time": "{{tomorrow}}",
    //     "shipping_amount": {
    //         "currency_code": "USD",
    //         "value": "10.00"
    //     },
    //     "subscriber": {
    //         "name": {
    //             "given_name": "FooBuyer",
    //             "surname": "Jones"
    //         },
    //         "email_address": "foobuyer@example.com",
    //         "shipping_address": {
    //             "name": {
    //                 "full_name": "John Doe"
    //             },
    //             "address": {
    //                 "address_line_1": "2211 N First Street",
    //                 "address_line_2": "Building 17",
    //                 "admin_area_2": "San Jose",
    //                 "admin_area_1": "CA",
    //                 "postal_code": "95131",
    //                 "country_code": "US"
    //             }
    //         }
    //     },
    //     "application_context": {
    //         "brand_name": "Example Inc",
    //         "locale": "en-US",
    //         "shipping_preference": "SET_PROVIDED_ADDRESS",
    //         "user_action": "SUBSCRIBE_NOW",
    //         "payment_method": {
    //             "payer_selected": "PAYPAL",
    //             "payee_preferred": "IMMEDIATE_PAYMENT_REQUIRED"
    //         },
    //         "return_url": "https://example.com/return",
    //         "cancel_url": "https://example.com/cancel"
    //     }
    // }
  }

  async suspendSubscription(subscriptionId) {
    return this.postRequest(
      `${this.baseUrl}/v1/billing/subscriptions/${subscriptionId}/suspend`,
      {
        reason: "User requested suspension",
      },
      "Failed to suspend subscription"
    );
  }

  async activateSubscription(subscriptionId) {
    return this.postRequest(
      `${this.baseUrl}/v1/billing/subscriptions/${subscriptionId}/activate`,
      {
        reason: "User renews subscription",
      },
      "Failed to activate subscription"
    );
  }

  async cancelSubscription(subscriptionId) {
    return this.postRequest(
      `${this.baseUrl}/v1/billing/subscriptions/${subscriptionId}/cancel`,
      {
        reason: "User requested cancellation",
      },
      "Failed to cancel subscription"
    );
  }
  // TODO: create billing plan
  // TODO: create subscription
  // TODO: update subscription

  //   zmiana daty płatności dla subskrypcji nie jest możliwa
  // https://www.perplexity.ai/search/jak-przez-api-paypala-zmienic-Tj1xGFVPS12X857uu6eFYQ
}

const PayPal = new PayPalSingleton();
// TODO: do testów postaw cloud run z dwoma metodami weryfikacji webhooka i wyświetlanie ostatniego requestu do api po wejściu na stronę główną (headers + rawBody)

// generate an access token using client id and app secret
// const generateAccessToken = async () => {
//   const auth = Buffer.from(
//     PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET
//   ).toString("base64");

//   const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
//     method: "POST",
//     body: "grant_type=client_credentials",
//     headers: {
//       Authorization: `Basic ${auth}`,
//     },
//   });

//   const data = await response.json();

//   return data.access_token;
// };

// const verifyPayPalWebhook = async (headers, body, accessToken) => {
//   const url = `${baseUrl}/v1/notifications/verify-webhook-signature`;
//   const res = await fetch(url, {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: `Bearer ${accessToken}`,
//     },
//     body: JSON.stringify({
//       transmission_id: headers["paypal-transmission-id"],
//       transmission_time: headers["paypal-transmission-time"],
//       cert_url: headers["paypal-cert-url"],
//       auth_algo: headers["paypal-auth-algo"],
//       transmission_sig: headers["paypal-transmission-sig"],
//       webhook_id: PAYPAL_AUTH_WEBHOOK_ID,
//       webhook_event: body,
//     }),
//   });

//   const data = await res.json();

//   console.log(`data`, data);

//   if (!res.ok) {
//     throw new Error(data.error_description);
//   }

//   return data.verification_status === "SUCCESS";
// };

// https://logographic-swarthily-era.ngrok-free.dev/webhook
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (request, response) => {
    const headers = request.headers;
    const event = request.body;
    const data = JSON.parse(event);

    const accessToken = await generateAccessToken();

    // response.status(200).json({ accessToken });

    const isValid = await verifyPayPalWebhook(headers, data, accessToken);

    console.log(`accessToken`, accessToken);
    console.log(`isValid`, isValid);

    // // const fixedHeaders = { ...headers };
    // // delete fixedHeaders["x-forwarded-for"];
    // // delete fixedHeaders["x-forwarded-proto"];
    // // delete fixedHeaders["x-forwarded-port"];

    // console.log(`headers`, headers);
    // // console.log(`parsed json`, JSON.stringify(data, null, 2));
    // // console.log(`raw event: ${event}`);

    // const isSignatureValid = await verifySignature(event, headers);
    // // const isSignatureValid = await verifySignature(event, fixedHeaders);

    // if (isSignatureValid) {
    //   console.log("Signature is valid.");

    //   // Successful receipt of webhook, do something with the webhook data here to process it, e.g. write to database
    //   console.log(`Received event`, JSON.stringify(data, null, 2));
    // } else {
    //   console.log(
    //     `Signature is not valid for ${data?.id} ${headers?.["correlation-id"]}`
    //   );
    //   // Reject processing the webhook event. May wish to log all headers+data for debug purposes.
    // }

    // // Return a 200 response to mark successful webhook delivery
    response.sendStatus(200);
  }
);

// https://developer.paypal.com/docs/api/catalog-products/v1/
// const createProduct = async (accessToken) => {
//   const url = `${baseUrl}/v1/catalogs/products`;
//   const uniqueId = uuidv4();

//   console.log(`uniqueId`, uniqueId);

//   const res = await fetch(url, {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: `Bearer ${accessToken}`,
//     },
//     body: JSON.stringify({
//       name: "Order Fee",
//       type: "PHYSICAL",
//       id: uniqueId,
//     }),
//   });

//   if (!res.ok) {
//     const errorData = await res.json();
//     throw new Error(errorData.error_description || "Failed to create product");
//   }

//   const data = await res.json();

//   console.log(`CREATE PRODUCT`, data);
//   return data;
// };

app.post("/webhook", async (req, res) => {
  const product = await createProduct(accessToken);
  res.status(200).json(product);
});

// app.listen(LISTEN_PORT, () => {
//   console.log(`Node server listening at http://localhost:${LISTEN_PORT}/`);
// });
