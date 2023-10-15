

  require('dotenv').config();
  const config = {
    user: process.env.user,
    password: process.env.password,
    server: process.env.server,
    database: process.env.database,
    options: {
      trustedconnection: true,
      trustServerCertificate: true,
      enableArithAbort: true,
      instancename: "",
    },
    port: 1433
  };
  
  module.exports = config;
  
