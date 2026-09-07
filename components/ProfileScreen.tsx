import { getLocalUser } from "../lib/localAuth";
import React, {
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  ArrowLeft,
  BookOpen,
  GraduationCap,
  LogOut,
  Mail,
  UserRound,
} from "lucide-react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  supabase,
} from "../lib/supabase";

type ProfileRow = {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string;
  app_role: string;
  status: string;
  school_id: string | null;
  class_level: string | null;
  subject_id: string | null;
};

type Props = {
  onBack: () => void;
};

function roleLabel(
  value: string | null
) {
  switch (value) {
    case "guru_kelas":
      return "Guru Kelas";

    case "guru_mapel":
      return "Guru Mapel";

    case "siswa":
      return "Siswa";

    case "ops":
    case "admin":
    case "ops_admin":
      return "Ops / Admin";

    default:
      return "Pengguna Diginaz";
  }
}

function getInitial(
  name: string
) {
  const clean =
    name.trim();

  if (!clean) {
    return "D";
  }

  return clean
    .charAt(0)
    .toUpperCase();
}

export default function ProfileScreen({
  onBack,
}: Props) {
  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    logoutLoading,
    setLogoutLoading,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    name,
    setName,
  ] = useState(
    "Pengguna Diginaz"
  );

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    role,
    setRole,
  ] =
    useState<string | null>(
      null
    );

  const [
    classLevel,
    setClassLevel,
  ] =
    useState<string | null>(
      null
    );

  const [
    subjectId,
    setSubjectId,
  ] =
    useState<string | null>(
      null
    );

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setErrorMessage("");

      try {
        const {
          data: userData,
          error: userError,
        } =
          await getLocalUser();

        if (userError) {
          throw userError;
        }

        const user =
          userData.user;

        if (!user) {
          throw new Error(
            "Session pengguna tidak ditemukan."
          );
        }

        const fallbackName =
          String(
            user.user_metadata
              ?.full_name ||
            user.user_metadata
              ?.name ||
            user.email ||
            "Pengguna Diginaz"
          ).trim();

        const fallbackEmail =
          user.email ?? "";

        let profileRow:
          ProfileRow | null =
          null;

        const {
          data: byAuthId,
          error: authProfileError,
        } =
          await supabase
            .from("app_profiles")
            .select(
              "id,auth_user_id,email,full_name,app_role,status,school_id,class_level,subject_id"
            )
            .eq(
              "auth_user_id",
              user.id
            )
            .maybeSingle();

        if (authProfileError) {
          throw authProfileError;
        }

        if (byAuthId) {
          profileRow =
            byAuthId as unknown as ProfileRow;
        } else if (
          fallbackEmail
        ) {
          const {
            data: byEmail,
            error: emailProfileError,
          } =
            await supabase
              .from(
                "app_profiles"
              )
              .select(
                "id,auth_user_id,email,full_name,app_role,status,school_id,class_level,subject_id"
              )
              .ilike(
                "email",
                fallbackEmail
              )
              .limit(1)
              .maybeSingle();

          if (
            emailProfileError
          ) {
            throw emailProfileError;
          }

          if (byEmail) {
            profileRow =
              byEmail as unknown as ProfileRow;
          }
        }

        if (!active) {
          return;
        }

        setName(
          profileRow
            ?.full_name
            ?.trim() ||
            fallbackName
        );

        setEmail(
          profileRow
            ?.email
            ?.trim() ||
            fallbackEmail
        );

        setRole(
          profileRow
            ?.app_role ??
            null
        );

        setClassLevel(
          profileRow
            ?.class_level ??
            null
        );

        setSubjectId(
          profileRow
            ?.subject_id ??
            null
        );
      } catch (error) {
        console.error(
          "Gagal memuat profil:",
          error
        );

        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Profil belum dapat dimuat."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    if (logoutLoading) {
      return;
    }

    setLogoutLoading(true);
    setErrorMessage("");

    try {
      const { GoogleSignin } = await import(
        "@react-native-google-signin/google-signin"
      );

      await GoogleSignin.signOut();

      const {
        error,
      } =
        await supabase.auth
          .signOut();

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error(
        "Logout gagal:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Belum dapat keluar."
      );
    } finally {
      setLogoutLoading(false);
    }
  }

  function confirmLogout() {
    Alert.alert(
      "Keluar dari Diginaz?",
      "Anda perlu masuk kembali dengan akun Google untuk menggunakan Diginaz Store.",
      [
        {
          text: "Batal",
          style: "cancel",
        },
        {
          text: "Keluar",
          style: "destructive",
          onPress: () => {
            void handleLogout();
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={[
        "top",
        "bottom",
      ]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
      />

      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          style={styles.backButton}
          hitSlop={8}
        >
          <ArrowLeft
            size={21}
            color="#0F172A"
          />
        </Pressable>

        <Text style={styles.headerTitle}>
          Profil
        </Text>

        <View
          style={styles.headerSpacer}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="small"
            color="#2563EB"
          />

          <Text style={styles.loadingText}>
            Memuat profil...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={
            styles.content
          }
          showsVerticalScrollIndicator={
            false
          }
        >
          <View
            style={styles.profileCard}
          >
            <View
              style={styles.avatar}
            >
              <Text
                style={styles.avatarText}
              >
                {getInitial(name)}
              </Text>
            </View>

            <Text
              style={styles.name}
            >
              {name}
            </Text>

            <Text
              style={styles.role}
            >
              {roleLabel(role)}
            </Text>
          </View>

          <View
            style={styles.infoCard}
          >
            <View
              style={styles.infoRow}
            >
              <View
                style={styles.infoIcon}
              >
                <Mail
                  size={17}
                  color="#2563EB"
                />
              </View>

              <View
                style={styles.infoText}
              >
                <Text
                  style={styles.infoLabel}
                >
                  Email
                </Text>

                <Text
                  style={styles.infoValue}
                  numberOfLines={1}
                >
                  {email ||
                    "-"}
                </Text>
              </View>
            </View>

            <View
              style={styles.divider}
            />

            <View
              style={styles.infoRow}
            >
              <View
                style={styles.infoIcon}
              >
                <UserRound
                  size={17}
                  color="#2563EB"
                />
              </View>

              <View
                style={styles.infoText}
              >
                <Text
                  style={styles.infoLabel}
                >
                  Jenis Akun
                </Text>

                <Text
                  style={styles.infoValue}
                >
                  {roleLabel(
                    role
                  )}
                </Text>
              </View>
            </View>

            {classLevel ? (
              <>
                <View
                  style={styles.divider}
                />

                <View
                  style={styles.infoRow}
                >
                  <View
                    style={
                      styles.infoIcon
                    }
                  >
                    <GraduationCap
                      size={17}
                      color="#2563EB"
                    />
                  </View>

                  <View
                    style={
                      styles.infoText
                    }
                  >
                    <Text
                      style={
                        styles.infoLabel
                      }
                    >
                      Kelas
                    </Text>

                    <Text
                      style={
                        styles.infoValue
                      }
                    >
                      {
                        classLevel
                      }
                    </Text>
                  </View>
                </View>
              </>
            ) : null}

            {subjectId ? (
              <>
                <View
                  style={styles.divider}
                />

                <View
                  style={styles.infoRow}
                >
                  <View
                    style={
                      styles.infoIcon
                    }
                  >
                    <BookOpen
                      size={17}
                      color="#2563EB"
                    />
                  </View>

                  <View
                    style={
                      styles.infoText
                    }
                  >
                    <Text
                      style={
                        styles.infoLabel
                      }
                    >
                      Mata Pelajaran
                    </Text>

                    <Text
                      style={
                        styles.infoValue
                      }
                    >
                      {subjectId}
                    </Text>
                  </View>
                </View>
              </>
            ) : null}
          </View>

          {errorMessage ? (
            <Text
              style={styles.errorText}
            >
              {errorMessage}
            </Text>
          ) : null}

          <Pressable
            onPress={confirmLogout}
            disabled={
              logoutLoading
            }
            style={[
              styles.logoutButton,
              logoutLoading &&
                styles.logoutDisabled,
            ]}
          >
            {logoutLoading ? (
              <ActivityIndicator
                size="small"
                color="#DC2626"
              />
            ) : (
              <>
                <LogOut
                  size={18}
                  color="#DC2626"
                />

                <Text
                  style={
                    styles.logoutText
                  }
                >
                  Keluar
                </Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        "#F8FAFC",
    },

    header: {
      height: 62,
      paddingHorizontal: 12,
      backgroundColor:
        "#FFFFFF",
      borderBottomWidth: 1,
      borderBottomColor:
        "#E2E8F0",
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
    },

    backButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent:
        "center",
    },

    headerTitle: {
      fontFamily:
        "PlusJakartaSans_600SemiBold",
      fontSize: 15,
      color: "#0F172A",
    },

    headerSpacer: {
      width: 40,
    },

    center: {
      flex: 1,
      alignItems: "center",
      justifyContent:
        "center",
      gap: 8,
    },

    loadingText: {
      fontFamily:
        "PlusJakartaSans_400Regular",
      fontSize: 10.5,
      color: "#64748B",
    },

    content: {
      padding: 16,
      paddingBottom: 32,
    },

    profileCard: {
      alignItems: "center",
      paddingVertical: 22,
      paddingHorizontal: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "#E2E8F0",
      backgroundColor:
        "#FFFFFF",
    },

    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#DBEAFE",
    },

    avatarText: {
      fontFamily:
        "PlusJakartaSans_700Bold",
      fontSize: 26,
      color: "#2563EB",
    },

    name: {
      marginTop: 12,
      fontFamily:
        "PlusJakartaSans_600SemiBold",
      fontSize: 16,
      color: "#0F172A",
      textAlign: "center",
    },

    role: {
      marginTop: 3,
      fontFamily:
        "PlusJakartaSans_400Regular",
      fontSize: 10.5,
      color: "#64748B",
    },

    infoCard: {
      marginTop: 14,
      paddingHorizontal: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "#E2E8F0",
      backgroundColor:
        "#FFFFFF",
    },

    infoRow: {
      minHeight: 64,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
    },

    infoIcon: {
      width: 36,
      height: 36,
      borderRadius: 11,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#EFF6FF",
    },

    infoText: {
      flex: 1,
    },

    infoLabel: {
      fontFamily:
        "PlusJakartaSans_400Regular",
      fontSize: 9.5,
      color: "#94A3B8",
    },

    infoValue: {
      marginTop: 2,
      fontFamily:
        "PlusJakartaSans_500Medium",
      fontSize: 11.5,
      color: "#0F172A",
    },

    divider: {
      height: 1,
      marginLeft: 47,
      backgroundColor:
        "#F1F5F9",
    },

    errorText: {
      marginTop: 10,
      fontFamily:
        "PlusJakartaSans_400Regular",
      fontSize: 9.5,
      lineHeight: 15,
      color: "#DC2626",
    },

    logoutButton: {
      minHeight: 46,
      marginTop: 18,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: "#FECACA",
      backgroundColor:
        "#FEF2F2",
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 8,
    },

    logoutDisabled: {
      opacity: 0.6,
    },

    logoutText: {
      fontFamily:
        "PlusJakartaSans_600SemiBold",
      fontSize: 11.5,
      color: "#DC2626",
    },
  });
