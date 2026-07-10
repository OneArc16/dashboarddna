import type { NextApiRequest, NextApiResponse } from "next";

type HealthResponse = {
  ok: true;
  service: string;
};

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponse<HealthResponse>,
) {
  res.status(200).json({
    ok: true,
    service: "dashboarddna",
  });
}
