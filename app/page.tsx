import PaypalButtons from "@/components/paypal-buttons";
import WebhookData from "@/components/webhook-data";

export default function Home() {
  return (
    <div>
      <PaypalButtons orderId="test-order-id-123" isRecurring={false} />
      <PaypalButtons orderId="test-order-id-123" isRecurring={true} />
      <WebhookData />
    </div>
  );
}
