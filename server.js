const express = require("express");
const mysql = require("mysql2");
const jwt = require("jsonwebtoken");


const app = express();
app.use(express.json());

const db = mysql.createPool({
    host: "127.0.0.1",
    user: "root",
    password: "Maneesh@123",
    database: "file_transfer",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
try { app.listen(3000, () => {
    console.log("Server is running");
  });
} catch (e) {
    console.log(`Error : ${e.message}`);
  };


// db.query('select * from file',(error,results) => {
//     if (error) {
//         console.error(error);
//     } else {
//         console.log(results);
//     }
// });

const authenticateToken = (request, response, next) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if (authHeader !== undefined) {
      jwtToken = authHeader.split(" ")[1];
    }
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "MY_SECRET_STRING", async (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          const { username } = payload;
          request.username = username;
          next();
        }
      });
    }
  };

app.post("/register/", async (request, response) => {
    try {
      const { username, usertype , name , password} = request.body;

      if (usertype === 'ops') {
            return response.status(400).send("New operation users are not allowed to register. If you are already registered please login or please register as client.")
        }

      const findUserQuery = `SELECT * FROM user WHERE username = ?`;
  
      const [existingUser] = await db.promise().query(findUserQuery, [username]);
  
      if (existingUser.length > 0) {
        return response.status(400).send("User already exists");
      }
  
      if (password.length < 6) {
        return response.status(400).send("Password is too short");
      }
  
      
      const postUserQuery = `
        INSERT INTO user (username, usertype , name , password)
        VALUES (?, ?, ?, ?)
      `;
  
      await db.promise().execute(postUserQuery, [username, usertype , name , password]);
  
      return response.status(200).send("User created successfully");
    } catch (error) {
      console.error("Error during registration:", error);
      return response.status(500).send("Internal Server Error");
    }
  });

  
app.post("/login/", async (request, response) => {
  try {
    const { username, password } = request.body;
    const findUserQuery = `SELECT * FROM user WHERE username = ?`;

    db.query(findUserQuery, [username], async (error, results) => {
      if (error) {
        throw error;
      }

      if (results.length === 0) {
        response.status(401).send("Invalid user");
      } else {
        const user = results[0];
        
        if (password !== user.password) {
          response.status(401).send("Invalid password");
        } else {
          const payload = { username: username };
          const jwtToken = jwt.sign(payload, "MY_SECRET_STRING");
          response.send({ jwtToken });
        }
      }
    });
  } catch (error) {
    response.status(500).send("Internal Server Error");
  }
});


app.post("/fileupload/" , authenticateToken, async(request , response) => {
    try {
        const {username , file_id , file_name , url,file_type} = request.body;

        if (file_type !== "docx" && file_type !== "pdfx" && file_type !=="pptx" && file_type !== "xlsx") {
            return response.status(400).send("Invalid file type");
        }

        const findUserType = `SELECT usertype FROM user WHERE username = ?`;

        const [correctUserType] = await db.promise().query(findUserType, [username]);
        // return response.send(correctUserType);

        if (correctUserType[0].usertype === "client"){
            return response.status(400).send("Only Operation User can upload files");
        } 

        const findUrl = `SELECT * FROM file WHERE url = ?`;

        const [existingUrl] = await db.promise().query(findUrl , [url]);
        // return response.send(existingUrl);

        if (existingUrl.length > 0) {
            return response.status(400).send("File already exists");
        }

        const findFileName= `SELECT * FROM file WHERE file_name = ?`;

        const [existingFileName] = await db.promise().query(findFileName , [file_name]);

        if (existingFileName.length > 0) {
            return response.status(400).send("File with this name already exists");
        }

        const findFileId= `SELECT * FROM file WHERE file_id = ?`;

        const [existingFileId] = await db.promise().query(findFileId, [file_id]);

        if (existingFileId.length > 0) {
            return response.status(400).send("File with this ID already exists");
        }

        const postUserQuery = `
        INSERT INTO file (file_id , file_name , url,file_type)
        VALUES (?, ?, ?,?)
      `;
  
       await db.promise().execute(postUserQuery, [file_id , file_name , url,file_type]);
  
       return response.status(200).send("File uploaded successfully")
    } catch (error) {
      response.status(500).send("Internal Server Error");
    }   
});


app.get("/downloadfile/:file_id/" , authenticateToken , async(request , response) => {
    const {username} = request;
    const checkUserType = `SELECT usertype FROM user WHERE username = ?`;
    const [returnUserType] = await db.promise().query(checkUserType,[username]);
    if(returnUserType[0].usertype === 'ops') {
        return response.status(400).send("Operation user can't download file");
    }
    try {
        const {file_id} = request.params;
        const findUserQuery = `SELECT url FROM file WHERE file_id = ?`;
        const [documentUrl] = await db.promise().query(findUserQuery,[file_id]);

        if (documentUrl.length === 0) {
            return response.status(400).send("Sorry , No file with this file ID is present in the database.")
        }
        // return response.send(documentUrl);
        return response.status(200).send("download link : " + documentUrl[0].url)
    } catch (error) {
        response.status(500).send("Internal Server Error");
    }
});

app.get("/fileslist/" ,authenticateToken, async (request,response) => {
    const {username} = request;
    const checkUserType = `SELECT usertype FROM user WHERE username = ?`;
    const [returnUserType] = await db.promise().query(checkUserType,[username]);
    if(returnUserType[0].usertype === 'ops') {
        return response.status(400).send("Operation user can't access all files list");
    }
    try {

        const findUserQuery = `SELECT * FROM file`;

        const [getAllFiles] = await db.promise().query(findUserQuery);

        return response.status(200).send(getAllFiles);

    } catch (error) {
        response.status.send("Internal Server Error");
    }
})