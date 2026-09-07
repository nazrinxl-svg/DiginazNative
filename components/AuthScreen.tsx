import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";

function GoogleMark() {
  return (
    <Svg
      width={17}
      height={17}
      viewBox="0 0 48 48"
    >
      <Path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 19.5-8 19.5-20c0-1.2-.1-2.3-.3-3.5z"
      />

      <Path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.2 4 9.4 8.5 6.3 14.7z"
      />

      <Path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.8-3.4-11.4-8.1L6.1 33C9.2 39.5 16 44 24 44z"
      />

      <Path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </Svg>
  );
}

async function completeGoogleOAuth(
  callbackUrl: string
) {
  const url =
    new URL(callbackUrl);

  const oauthError =
    url.searchParams.get(
      "error_description"
    ) ??
    url.searchParams.get(
      "error"
    );

  if (oauthError) {
    throw new Error(
      decodeURIComponent(
        oauthError
      )
    );
  }

  const code =
    url.searchParams.get("code");

  if (code) {
    const { error } =
      await supabase.auth
        .exchangeCodeForSession(
          code
        );

    if (error) {
      throw error;
    }

    return;
  }

  const fragment =
    callbackUrl.includes("#")
      ? callbackUrl.split("#")[1]
      : "";

  const hash =
    new URLSearchParams(
      fragment
    );

  const accessToken =
    hash.get("access_token");

  const refreshToken =
    hash.get("refresh_token");

  if (
    accessToken &&
    refreshToken
  ) {
    const { error } =
      await supabase.auth
        .setSession({
          access_token:
            accessToken,
          refresh_token:
            refreshToken,
        });

    if (error) {
      throw error;
    }

    return;
  }

  throw new Error(
    "Session Google tidak ditemukan."
  );
}

export default function AuthScreen() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  useEffect(() => {
    if (
      Platform.OS !== "web" ||
      typeof window === "undefined"
    ) {
      return;
    }

    const currentUrl =
      window.location.href;

    if (
      !currentUrl.includes("code=") &&
      !currentUrl.includes("access_token=") &&
      !currentUrl.includes("error=")
    ) {
      return;
    }

    void (
      async () => {
        try {
          setGoogleLoading(true);

          await completeGoogleOAuth(
            currentUrl
          );

          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
        } catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Login Google gagal."
          );
        } finally {
          setGoogleLoading(false);
        }
      }
    )();
  }, []);

  async function handleGoogleLogin() {
    if (googleLoading) {
      return;
    }

    setGoogleLoading(true);
    setErrorMessage("");

    try {
      if (
        Platform.OS === "web"
      ) {
        const redirectTo =
          typeof window !== "undefined"
            ? window.location.origin
            : undefined;

        const { error } =
          await supabase.auth
            .signInWithOAuth({
              provider: "google",
              options: {
                redirectTo,
              },
            });

        if (error) {
          throw error;
        }

        return;
      }

      const webClientId =
        process.env
          .GOOGLE_WEB_CLIENT_ID
          ?.trim();

      if (!webClientId) {
        throw new Error(
          "Google Web Client ID belum dikonfigurasi."
        );
      }

      const {
        GoogleSignin,
        isSuccessResponse,
      } =
        await import(
          "@react-native-google-signin/google-signin"
        );

      GoogleSignin.configure({
        webClientId,
      });

      await GoogleSignin
        .hasPlayServices();

      const response =
        await GoogleSignin
          .signIn();

      if (
        !isSuccessResponse(
          response
        )
      ) {
        return;
      }

      const idToken =
        response.data.idToken;

      if (!idToken) {
        throw new Error(
          "Google tidak memberikan ID token."
        );
      }

      const {
        error,
      } =
        await supabase.auth
          .signInWithIdToken({
            provider: "google",
            token: idToken,
          });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error(
        "Google login gagal:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Login Google belum dapat diproses."
      );
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "bottom"]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
      />

      <View style={styles.page}>
        <View style={styles.content}>
          <Image
            source={require("../assets/diginaz-logo.png")}
            resizeMode="contain"
            style={styles.logo}
          />

          <Text style={styles.brandTitle}>
            Diginaz
          </Text>

          <View style={styles.card}>
            {errorMessage ? (
              <Text style={styles.errorText}>
                {errorMessage}
              </Text>
            ) : null}

            <Pressable
              onPress={handleGoogleLogin}
              disabled={googleLoading}
              style={[
                styles.googleButton,
                googleLoading &&
                  styles.googleButtonDisabled,
              ]}
            >
              {googleLoading ? (
                <ActivityIndicator
                  size="small"
                  color="#2563EB"
                />
              ) : (
                <>
                  <GoogleMark />

                  <Text style={styles.googleButtonText}>
                    Masuk dengan Google
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  keyboardView: {
    flex: 1,
  },

  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
  },

  content: {
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    transform: [
      {
        translateY: -18,
      },
    ],
  },

  logo: {
    width: 76,
    height: 76,
    marginBottom: 5,
  },

  brandTitle: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 31,
    lineHeight: 38,
    letterSpacing: -1,
    color: "#0F172A",
    marginBottom: 8,
  },

  card: {
    width: "100%",
    padding: 9,
    borderWidth: 1,
    borderColor: "#DCE6F5",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",

    shadowColor: "#2563EB",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 9,
    },

    elevation: 2,
  },

  inputBox: {
    height: 44,
    marginBottom: 7,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 9,
    backgroundColor: "#EAF2FF",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  input: {
    flex: 1,
    height: "100%",
    paddingVertical: 0,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 12.5,
    color: "#334155",
  },

  eyeButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
  },

  forgotButton: {
    alignSelf: "flex-start",
    marginTop: -1,
    marginBottom: 7,
  },

  forgotText: {
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 10.5,
    color: "#2563EB",
  },

  errorText: {
    marginBottom: 7,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 10,
    lineHeight: 15,
    color: "#E11D48",
  },

  infoBox: {
    marginBottom: 7,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  infoText: {
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 9.5,
    lineHeight: 14,
    color: "#475569",
  },

  loginPressable: {
    width: "100%",
  },

  loginButton: {
    width: "100%",
    height: 44,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  loginButtonText: {
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: "#FFFFFF",
  },

  divider: {
    marginVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E2E8F0",
  },

  dividerText: {
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 11,
    color: "#94A3B8",
  },

  googleButton: {
    width: "100%",
    height: 42,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },

  googleButtonDisabled: {
    opacity: 0.6,
  },

  googleButtonText: {
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 11.5,
    color: "#334155",
  },
});

