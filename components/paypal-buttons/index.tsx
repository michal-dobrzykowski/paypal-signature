"use client";
import React, { useState } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { PayPalButtonsProps } from "./types";
import { buttonStyle } from "./consts";
// import { sdk } from "@lib/config"
import {
  PayPalButtonCreateSubscription,
  PayPalButtonOnApprove,
} from "@paypal/paypal-js";
import { OneTimeButton } from "./one-time-button";
import { SubscriptionButton } from "./subscription-button";

const PaypalButtons = ({
  orderId,
  currency = "EUR",
  isRecurring,
}: PayPalButtonsProps) => {
  const initialOptions: any = {
    "client-id": process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "",
    // clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "",
    // "enable-funding": "",
    // "disable-funding": "",
    // country: "US",
    vault: true,
    currency,
    // "data-page-type": "product-details",
    // components: "buttons",
    // "data-sdk-integration-source": "developer-studio",
  };

  return (
    <PayPalScriptProvider options={initialOptions}>
      {isRecurring ? <SubscriptionButton /> : <OneTimeButton />}
    </PayPalScriptProvider>
  );
};

export default PaypalButtons;
