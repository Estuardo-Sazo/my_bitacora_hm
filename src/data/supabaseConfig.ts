/** Kept apart from the SDK so demo visitors never download it. */
export const supabaseOptions = {
  url: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined,
};

export const isSupabaseConfigured = Boolean(supabaseOptions.url && supabaseOptions.publishableKey);

/** Google needs its own setup in Supabase, so the button appears only once it is enabled. */
export const isGoogleEnabled = import.meta.env.VITE_AUTH_GOOGLE === 'true';
