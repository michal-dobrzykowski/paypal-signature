import { PayPalButtons } from "@paypal/react-paypal-js";
import { buttonStyle } from "./consts";

export const SubscriptionButton = () => {
  const createSubscription = async (data: any, actions: any) => {
    const response = await fetch("/api/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartId: "test-cart-id-123",
      }),
    });
    const subscription = await response.json();
    console.log("subscription", subscription);

    return subscription.id;
  };

  const onApprove = async (data: any, actions: any) => {
    // const response = await fetch("/api/subscription/capture", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ orderId: data.orderID }),
    // });
    // const captureData = await response.json();
    // console.log("Capture result", captureData);
    console.log("onApprove", data);

    alert("Płatność zakończona sukcesem!");
  };

  return (
    <PayPalButtons
      style={buttonStyle}
      createSubscription={createSubscription}
      onApprove={onApprove}
    />
  );
};
