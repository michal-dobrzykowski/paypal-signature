"use client";

import { useEffect, useState } from "react";

const WebhookData = () => {
  const [data, setData] = useState([]);

  const getData = async () => {
    const res = await fetch("/api/webhook", {
      method: "GET",
      cache: "no-store",
    });
    const data = await res.json();
    console.log("webhook data", data);
    setData(data);
  };

  useEffect(() => {
    getData();
  }, []);

  return <div>WebhookData: {JSON.stringify(data)}</div>;
};

export default WebhookData;
