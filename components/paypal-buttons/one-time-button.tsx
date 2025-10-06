import { PayPalButtons } from "@paypal/react-paypal-js";
import { buttonStyle } from "./consts";

export const OneTimeButton = () => {
  const createOrder = async (data: any, actions: any) => {
    const response = await fetch("/api/orders/one-time", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartId: "test-cart-id-123",
      }),
    });
    const order = await response.json();
    return order.id;
  };

  const onApprove = async (data: any, actions: any) => {
    const response = await fetch("/api/orders/one-time/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: data.orderID }),
    });
    const captureData = await response.json();
    // console.log("Capture result", captureData);

    alert("Płatność zakończona sukcesem!");
  };

  return (
    <PayPalButtons
      style={buttonStyle}
      createOrder={createOrder}
      onApprove={onApprove}
    />
  );
};
