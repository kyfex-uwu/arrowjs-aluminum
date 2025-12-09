import express from "express";

const app = new express();

app.get("arrowjs-aluminum/dist/index.js", (req,res)=>
    res.sendFile("/home/abby/Documents/github/arrowjs-aluminum/docs/404.html"));
app.get(/arrowjs-aluminum.*/, (req,res)=>
    res.sendFile("/home/abby/Documents/github/arrowjs-aluminum/docs/404.html"));

app.use("/", express.static("/home/abby/Documents/github/arrowjs-aluminum"));
app.get(/.*/, (req,res)=>
    res.sendFile("/home/abby/Documents/github/arrowjs-aluminum/testing.html"));

app.listen(4000);
