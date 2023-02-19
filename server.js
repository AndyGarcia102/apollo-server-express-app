const mongoose = require("mongoose");
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { ApolloServerPluginDrainHttpServer } = require('@apollo/server/plugin/drainHttpServer');
const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const typeDefs = require("./typeDefs");
const resolvers = require("./resolver");
const cookie = require("cookie");
const path = require('path');
require('dotenv').config();


async function startServer(){

    const app = express();

    const httpServer = http.createServer(app);

    const server = new ApolloServer({
        typeDefs,
        resolvers,
        introspection: true,
        plugins:[ApolloServerPluginDrainHttpServer({httpServer})]
    });


    await server.start();

    app.set('view engine', 'ejs');

    app.use(
        '/graphql',
        cors({
            origin: ['http://localhost:3000','http://localhost:8080/graphql', 'https://studio.apollogrpahql.com'],
            credentials: true,
        }),
        bodyParser.json(),
        expressMiddleware(server, {
            context: async ({req,res}) => {
                const token = req.headers.authorization || '';
                console.log("Token??");
                console.log(token);


                return {req,res}
            },
            listen:{port:8080},
        }
        ),
        
    );

    // app.use(express.static(path.join(__dirname, "Web/client", "build")));

    // app.use((req, res, next) => {
    //     res.sendFile(path.join(__dirname, "Web/client", "build", "index.html"));
    // });
    

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Mongoose Connected...");
    await new Promise((resolve) => httpServer.listen({port:8080}, resolve));

    console.log(`🚀 Server ready at` + 8080);

 }

startServer();

