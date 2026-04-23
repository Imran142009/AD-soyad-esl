import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

export const wsUrl = (path) => {
  const base = BACKEND_URL.replace(/^http/, "ws");
  return `${base}/api${path}`;
};

export const CATEGORY_LABELS = {
  ad: "Ad",
  soyad: "Soyad",
  seher: "Şəhər",
  olke: "Ölkə",
  bitki: "Bitki",
  heyvan: "Heyvan",
  esya: "Əşya",
};

export const CATEGORY_KEYS = ["ad", "soyad", "seher", "olke", "bitki", "heyvan", "esya"];
