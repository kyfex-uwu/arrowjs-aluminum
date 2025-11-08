import express from "express";

const app = new express();

app.use("/", express.static("/home/abby/Documents/github/arrowjs-aluminum"));
app.get(/.*/, (req,res)=>res.sendFile("/home/abby/Documents/github/arrowjs-aluminum/testing.html"));

app.listen(4000);
