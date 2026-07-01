import { Tabs } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";

function HomeIcon({ color }: { color: string }) {
  return (
    <View style={[styles.icon]}>
      <View style={[styles.iconHouse, { borderColor: color }]} />
      <View style={[styles.iconDoor, { borderColor: color, backgroundColor: color + "40" }]} />
    </View>
  );
}

function HeartIcon({ color }: { color: string }) {
  return (
    <View style={styles.icon}>
      <View style={[styles.iconHeart, { borderColor: color }]}>
        <View style={[styles.iconHeartDot, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

function UserIcon({ color }: { color: string }) {
  return (
    <View style={styles.icon}>
      <View style={[styles.iconHead, { borderColor: color }]} />
      <View style={[styles.iconBody, { borderColor: color }]} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#080a10",
          borderTopColor: "#1a1c2a",
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#9333ea",
        tabBarInactiveTintColor: "#3d3f50",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Date",
          tabBarIcon: ({ color }) => <HeartIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Messages",
          tabBarIcon: ({ color }) => (
            <View style={styles.icon}>
              <View style={[styles.iconMsg, { borderColor: color }]}>
                <View style={[styles.iconMsgDot, { backgroundColor: color }]} />
              </View>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <UserIcon color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  iconHouse: { width: 16, height: 12, borderWidth: 1.5, borderRadius: 2 },
  iconDoor: { width: 8, height: 6, borderWidth: 1, borderRadius: 1, marginTop: -2 },
  iconHeart: { width: 16, height: 16, borderWidth: 1.5, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  iconHeartDot: { width: 5, height: 5, borderRadius: 3 },
  iconHead: { width: 10, height: 10, borderWidth: 1.5, borderRadius: 5 },
  iconBody: { width: 14, height: 7, borderWidth: 1.5, borderRadius: 7, marginTop: 2, borderBottomWidth: 0 },
  iconMsg: { width: 16, height: 14, borderWidth: 1.5, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  iconMsgDot: { width: 5, height: 2.5, borderRadius: 1.5, marginBottom: 1 },
});
