const {
  PAYPAL_SANDBOX,
  NEXT_PUBLIC_PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  PAYPAL_AUTH_WEBHOOK_ID,
} = process.env;

export class PayPalSingleton {
  public baseUrl: string = "https://api-m.sandbox.paypal.com";
  public accessToken: string | null = null;
  public productId: string = "";
  private static instance: PayPalSingleton;
  private static exists: boolean = false;

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

  // done & tested
  async createAccessToken() {
    const auth = Buffer.from(
      NEXT_PUBLIC_PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET
    ).toString("base64");

    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      body: "grant_type=client_credentials",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error_description || "Failed to get access token"
      );
    }

    const data = await response.json();

    this.accessToken = data.access_token;
    return this.accessToken;
  }

  // done & tested
  async getAccessToken() {
    if (this.accessToken) {
      return this.accessToken;
    }
    return this.createAccessToken();
  }

  // done & tested
  async postRequest<T>(
    url: string,
    body: any,
    defaultErrorMessage: string
  ): Promise<T> {
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
        return this.postRequest<T>(url, body, defaultErrorMessage);
      }

      const errorData = (await res.json()) as { error_description?: string };
      throw new Error(errorData.error_description || defaultErrorMessage);
    }

    const data = (await res.json()) as T;
    return data;
  }

  // done & tested
  async getRequest<T>(url: string, defaultErrorMessage: string): Promise<T> {
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
        return this.getRequest<T>(url, defaultErrorMessage);
      }

      const errorData = (await res.json()) as { error_description?: string };
      throw new Error(errorData.error_description || defaultErrorMessage);
    }

    const data = (await res.json()) as T;
    return data;
  }

  // https://developer.paypal.com/docs/api/catalog-products/v1/
  // done & tested
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

  // done & tested
  async getProductById(productId: string) {
    return this.getRequest(
      `${this.baseUrl}/v1/catalogs/products/${productId}`,
      "Failed to get product"
    );
  }

  async verifyWebhook(headers: Record<string, string>, body: any) {
    const data = await this.postRequest<{ verification_status: string }>(
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

  // done & tested
  async getOrCreateProduct() {
    try {
      const product = await this.getProductById(this.productId);

      return product;
    } catch (error) {
      const newProduct = await this.createProduct();

      return newProduct;
    }
  }

  // done & tested
  async createBillingPlan({
    productId = this.productId,
    name,
    currency = "USD",
    oneTimeAmount = null,
    recurringAmount,
  }: {
    productId?: string;
    name: string;
    currency?: string;
    oneTimeAmount?: number | null;
    recurringAmount: number;
  }) {
    // https://developer.paypal.com/docs/api/subscriptions/v1/
    let description = `Recurring payment of ${recurringAmount} ${currency} per month`;

    const payment_preferences: any = {
      auto_bill_outstanding: true,
      setup_fee_failure_action: "CONTINUE",
      payment_failure_threshold: 3,
    };

    if (oneTimeAmount) {
      payment_preferences.setup_fee = {
        value: oneTimeAmount,
        currency_code: currency,
      };
      payment_preferences.setup_fee_failure_action = "CONTINUE";
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
      payment_preferences,
    };

    return this.postRequest(
      `${this.baseUrl}/v1/billing/plans`,
      billingPlanData,
      "Failed to create billing plan"
    );
  }

  async updateBillingPlanPricing(
    billingPlanId: string,
    currency: string,
    newRecurringAmount: number
  ) {
    return this.postRequest(
      `${this.baseUrl}/v1/billing/plans/${billingPlanId}/update-pricing-schemes`,
      {
        pricing_schemes: [
          {
            billing_cycle_sequence: 1,
            pricing_scheme: {
              fixed_price: {
                value: newRecurringAmount,
                currency_code: currency,
              },
            },
          },
        ],
      },
      "Failed to update billing pricing plan"
    );
  }

  // done & tested
  async createSubscription(billingPlanId: string, customId: string) {
    await this.getAccessToken();

    const subscriptionData = {
      plan_id: billingPlanId,
      custom_id: customId,
    };

    return this.postRequest(
      `${this.baseUrl}/v1/billing/subscriptions`,
      subscriptionData,
      "Failed to create subscription"
    );
  }

  async suspendSubscription(subscriptionId: string) {
    return this.postRequest(
      `${this.baseUrl}/v1/billing/subscriptions/${subscriptionId}/suspend`,
      {
        reason: "User requested suspension",
      },
      "Failed to suspend subscription"
    );
  }

  async activateSubscription(subscriptionId: string) {
    return this.postRequest(
      `${this.baseUrl}/v1/billing/subscriptions/${subscriptionId}/activate`,
      {
        reason: "User renews subscription",
      },
      "Failed to activate subscription"
    );
  }

  async cancelSubscription(subscriptionId: string) {
    return this.postRequest(
      `${this.baseUrl}/v1/billing/subscriptions/${subscriptionId}/cancel`,
      {
        reason: "User requested cancellation",
      },
      "Failed to cancel subscription"
    );
  }

  // done & tested
  async createOrder(amount: string, currency: string, customId: string) {
    return this.postRequest(
      `${this.baseUrl}/v2/checkout/orders`,
      {
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: amount,
            },
            custom_id: customId,
          },
        ],
      },
      "Failed to create one-time order"
    );
  }
  // wywoła PAYMENT.CAPTURE.COMPLETED
  // w subskrypcji jest to PAYMENT.SALE.COMPLETED

  // done & tested
  async captureOrder(orderId: string) {
    return this.postRequest(
      `${this.baseUrl}/v2/checkout/orders/${orderId}/capture`,
      {},
      "Failed to capture one-time order"
    );
  }

  // TODO: create billing plan
  // TODO: create subscription
  // TODO: update subscription

  //   zmiana daty płatności dla subskrypcji nie jest możliwa
  // https://www.perplexity.ai/search/jak-przez-api-paypala-zmienic-Tj1xGFVPS12X857uu6eFYQ
}
