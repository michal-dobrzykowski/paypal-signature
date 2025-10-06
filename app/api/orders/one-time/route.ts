import { PayPalSingleton } from "@/components/helpers/paypal-singleton";

export const POST = async (req: Request) => {
  const body = await req.json();
  console.log("CREATE ONE-TIME ORDER", body);

  const PayPal = new PayPalSingleton();

  try {
    const data = await PayPal.createOrder("99", "EUR", "TEST-ORDER-ID-123");
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
