import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
// Publishable key (sb_publishable_...) é preferível. A variável antiga continua aceita.
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  url && key && !url.includes("SEU_PROJETO") && !url.includes("coloque_sua")
    && !key.includes("SUA_CHAVE") && !key.includes("COLE_A_CHAVE")
    ? createClient(url, key, {
        global: {
          fetch: async (input, init) => {
            const controller = new AbortController();
            const cancelar = () => controller.abort();
            if (init?.signal?.aborted) controller.abort();
            init?.signal?.addEventListener("abort", cancelar);
            const limite = setTimeout(cancelar, 12000);
            try { return await fetch(input, { ...init, signal: controller.signal }); }
            finally {
              clearTimeout(limite);
              init?.signal?.removeEventListener("abort", cancelar);
            }
          },
        },
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export async function garantirUsuarioAutenticado() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user;

  const { data: login, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return login.user;
}
