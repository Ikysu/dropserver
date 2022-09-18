const fastify = require('fastify')();
const fs = require("fs")
const uuid = require("uuid").v4;
const fastFolderSize = require('fast-folder-size')

fs.readdirSync("./files").forEach(file=>{
    fs.unlink("./files/"+file, ()=>{
        console.log("REMOVED:",file)
    });
})

var quota = 1024*1024*1024; // 1GB
var quota_files = 128 // Max Files
var delTime = 1000*60*60*6 // File delete time

var filestack = {

}

function getUUID() {
    var newuuid = uuid().split("-")[1];
    if(filestack[newuuid]){
        return getUUID()
    }else{
        return newuuid
    }
}


fastify.register(require('fastify-formbody'));
fastify.register(require('fastify-file-upload'), {
    limits: { fileSize: quota },
})

fastify.get("/", async (req, reply)=>{ // start page
    reply.type("text/html").send(fs.createReadStream("index.html"));
})

fastify.get("/$", async (req, reply)=>{ // start page
    reply.type("text/css").send(fs.createReadStream("style.css"));
})

fastify.get("/%", async (req, reply)=>{ // start page
    reply.type("application/json").send(fs.createReadStream("particles.json"));
})

fastify.post("/", async (req, reply)=>{ // upload
    reply.type("application/json")

    if(!req.raw.files) return {error:"File not found"}
    const list = Object.keys(req.raw.files);
    if(list.length!=1) return {error:"Only one file"}
    const data = req.raw.files[list[0]]
    if(fs.readdirSync("./files").length<quota_files){
        fastFolderSize('./files', async (err, bytes) => {
            if(err) return reply.send({error:"ERR"});
            console.log(bytes, data.size)
            if(bytes+data.size<=quota){
                var id = getUUID();
                filestack[id]={name:data.name,time:new Date().getTime()+delTime,mime:data.mimetype}
                fs.createWriteStream("./files/"+id).write(data.data)
                //await data.file.pipe(fs.createWriteStream("./files/"+id))
                //await pump(data.data, fs.createWriteStream("./files/"+id))
                console.log("NEW:",id)
                setTimeout(()=>{
                    fs.unlink("./files/"+id, ()=>{
                        console.log("REMOVED:",id)
                        delete filestack[req.params.token]
                    });
                },delTime)
                reply.send({id:id});
            }else{
                reply.send({error:"Max QUOTA"});
            }
        })
    }else{
        reply.send({error:"Max QUOTA files"});
    }
})

fastify.post("/:token", async (req, reply)=>{ // status
    reply.type("application/json")
    fs.stat("./files/"+req.params.token, (err, stats)=>{
        if(err) return reply.send({error:"File not found"})
        var {name, time} = filestack[req.params.token]
        if(!name) return reply.send({error:"File not found"})
        reply.type("application/json").send({
            name, time, size:stats.size
        });
    })
})

fastify.get("/:token", async (req, reply)=>{ // download
    if(filestack[req.params.token]){
        fs.stat("./files/"+req.params.token, (err, stats)=>{
            if(err) return reply.type("text/plain").send("Файл не существует")
            reply.header("Content-Length",stats.size)
            reply.type(filestack[req.params.token].mime).send(fs.createReadStream("./files/"+req.params.token));
        })
    }else{
        reply.type("text/plain").send("Файл не существует")
    }
})

fastify.delete("/:token", async (req, reply)=>{ // download
    reply.type("application/json")
    if(filestack[req.params.token]){
        fs.unlink("./files/"+req.params.token, ()=>{
            console.log("REMOVED:",req.params.token)
            delete filestack[req.params.token]
            reply.send({ok:true})
        });
    }else{
        reply.send({error:"File not found"})
    }
})


fastify.listen(7777, "0.0.0.0")