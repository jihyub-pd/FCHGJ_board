import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const STORAGE_KEY = "fc-record-v2";

  // 1. 데이터 불러오기 (GET)
  if (req.method === 'GET') {
    try {
      const data = await kv.get(STORAGE_KEY);
      return res.status(200).json(data || {});
    } catch (error) {
      return res.status(500).json({ error: "DB 연동 실패" });
    }
  }

  // 2. 데이터 업데이트 및 저장 (POST)
  if (req.method === 'POST') {
    try {
      const nextData = req.body;
      await kv.set(STORAGE_KEY, nextData);
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: "DB 업데이트 실패" });
    }
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
