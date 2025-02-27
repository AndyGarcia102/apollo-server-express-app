import { ApolloClient, ApolloLink, createHttpLink, InMemoryCache, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import jwtDecode from 'jwt-decode';
// import axios from "axios"

const web_uri = "https://sea-turtle-app-msdsw.ondigitalocean.app/graphql"
const web_uri2 = "https://dolphin-app-djupw.ondigitalocean.app/graphql"
const local_uri = "http://localhost:8080/graphql"

const httpLink = createHttpLink({
  uri: web_uri2,
  credentials: 'include',
  cache: new InMemoryCache(),
});

const authLink = new ApolloLink((operation, forward) => {

  const accessToken = localStorage.getItem("token");
  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      authorization: accessToken ? `Bearer ${accessToken}` : "",
    },
  }));

  return forward(operation);
});

const refreshLink = new ApolloLink((operation, forward) => {

  // const prevHeader = operation.getContext().headers.authorization;
  // const accessToken = prevHeader.split('Bearer')[1];
  const accessTokenLocal = localStorage.getItem("token");

  if (accessTokenLocal) {
    const decodedToken = jwtDecode(accessTokenLocal)
    const userId = decodedToken.id.trim();
    const userPrivilege = decodedToken.privilege.trim();


    // breaks the second we use this statement
    if (decodedToken.exp * 1000 < Date.now()) {
      getRefreshToken(userId, userPrivilege)
        .then(res => {
          operation.setContext(({ headers = {} }) => ({
            headers: {
              ...headers,
              authorization: accessTokenLocal ? `Bearer ${res}` : "",
            },
          }));
          return forward(operation);
        });
    }
  }
  return forward(operation);
});

const getRefreshToken = async (refreshTokenId, privilege) => {

  const query = `query Query($refreshTokenId: String, $privilege: String) {
      refreshToken(id: $refreshTokenId, privilege: $privilege)
    }`

  const graphqlQuery = {
    "operationName": "Query",
    "query": query,
    "variables": { refreshTokenId, privilege }
  }

  const refreshToken = await fetch("https://dolphin-app-djupw.ondigitalocean.app/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(graphqlQuery),
  });

  const res = await refreshToken.json();

  if (res.data.refreshToken === "" || res.data.refreshToken === undefined) {
    localStorage.clear();
    window.location.href = '/';
  }

  const newAccessToken = jwtDecode(res.data.refreshToken)

  localStorage.setItem("firstname", newAccessToken.firstname)
  localStorage.setItem("lastname", newAccessToken.lastname)
  localStorage.setItem("token", res.data.refreshToken);

  return res;
}

const client = new ApolloClient({
  link: from([authLink, refreshLink, httpLink]),
  cache: new InMemoryCache()
});

export default client;
