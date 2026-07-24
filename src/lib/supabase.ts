import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

// SecureStore has a 2048-byte value limit per key; a Supabase session (with
// a JWT + refresh token) can exceed that, so large values are chunked across
// multiple keys instead of truncated silently.
const CHUNK_SIZE = 1900;

const ChunkedSecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const chunkCountRaw = await SecureStore.getItemAsync(`${key}_chunks`);
    if (!chunkCountRaw) return SecureStore.getItemAsync(key);
    const chunkCount = Number(chunkCountRaw);
    const parts = await Promise.all(
      Array.from({ length: chunkCount }, (_, i) => SecureStore.getItemAsync(`${key}_${i}`)),
    );
    if (parts.some((p) => p === null)) return null;
    return parts.join("");
  },
  async setItem(key: string, value: string): Promise<void> {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      await SecureStore.deleteItemAsync(`${key}_chunks`);
      return;
    }
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}_${i}`, chunk)));
    await SecureStore.setItemAsync(`${key}_chunks`, String(chunks.length));
    await SecureStore.deleteItemAsync(key);
  },
  async removeItem(key: string): Promise<void> {
    const chunkCountRaw = await SecureStore.getItemAsync(`${key}_chunks`);
    if (chunkCountRaw) {
      const chunkCount = Number(chunkCountRaw);
      await Promise.all(
        Array.from({ length: chunkCount }, (_, i) => SecureStore.deleteItemAsync(`${key}_${i}`)),
      );
      await SecureStore.deleteItemAsync(`${key}_chunks`);
    }
    await SecureStore.deleteItemAsync(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: ChunkedSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
