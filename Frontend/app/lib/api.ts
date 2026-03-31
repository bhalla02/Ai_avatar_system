import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000";

export const sendText = async (text: string) => {
  const formData = new FormData();
  formData.append("text", text);

  const res = await axios.post(`${BASE_URL}/chat`, formData);
  return res.data;
};

export const sendAudio = async (blob: Blob) => {
  const formData = new FormData();
  formData.append("audio", blob, "audio.wav");

  const res = await axios.post(`${BASE_URL}/chat`, formData);
  return res.data;
};