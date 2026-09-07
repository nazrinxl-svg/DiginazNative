import { supabase } from "./supabase";

export async function getLocalUser() {
  const { data, error } =
    await supabase.auth.getSession();

  return {
    data: {
      user: data.session?.user ?? null,
    },
    error,
  };
}