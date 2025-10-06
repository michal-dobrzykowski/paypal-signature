import { PayPalSingleton } from "@/components/helpers/paypal-singleton";
import { NextApiRequest } from "next";

export const config = {
  api: {
    bodyParser: true,
  },
};

export const POST = async (req: Request) => {
  const body = await req.json();
  console.log("CAPTURE ONE-TIME ORDER", body);

  const PayPal = new PayPalSingleton();

  try {
    const data = await PayPal.captureOrder(body.orderId);
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
