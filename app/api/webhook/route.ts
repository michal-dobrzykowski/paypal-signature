import { PayPalSingleton } from "@/components/helpers/paypal-singleton";
import { NextRequest } from "next/server";

export const config = {
  api: {
    bodyParser: false,
  },
};

const recentWebhookEvents: Array<any> = [];

export const GET = async () => {
  return new Response(JSON.stringify(recentWebhookEvents), {
    status: 200,
  });
};

export const POST = async (request: NextRequest) => {
  const headers = Object.fromEntries(request.headers.entries());
  const rawBody = await request.arrayBuffer();
  const bodyString = Buffer.from(rawBody).toString();
  const PayPal = new PayPalSingleton();

  const eventData = JSON.parse(bodyString);

  recentWebhookEvents.push({
    eventData,
    receivedAt: new Date().toISOString(),
    headers,
  });

  try {
    const isValid = await PayPal.verifyWebhook(headers, eventData);
    console.log("isValid", isValid);

    recentWebhookEvents.push({
      isValid,
    });

    return new Response(JSON.stringify({ isValid }), {
      status: isValid ? 200 : 400,
    });
  } catch (error) {
    console.log("error", error);

    return new Response(JSON.stringify({ isValid: false }), {
      status: 400,
    });
  }
};
