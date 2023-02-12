import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import WelcomeScreen from "./app/screens/WelcomeScreen";
import LoginScreen from "./app/screens/LoginScreen";

import { ApolloClient, InMemoryCache, ApolloProvider } from "@apollo/client";

// Initialize Apollo Client
const client = new ApolloClient({
  uri: "https://sea-turtle-app-msdsw.ondigitalocean.app/graphql",
  cache: new InMemoryCache(),
});

export default function App() {
  return (
    //<WelcomeScreen></WelcomeScreen>
    <ApolloProvider client={client}>
      <LoginScreen></LoginScreen>
    </ApolloProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
