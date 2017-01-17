var express = require('express');
var router = express.Router();
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var _ = require('underscore');
var port     = process.env.PORT || 3000;

var firebase = require('firebase');
var request = require('request');
var connect = require('connect');
var json = require('json');
var fs = require('fs');
var crypto = require('crypto');
var FCM = require('fcm-push');

var mongoose = require('mongoose');
var mongodb = require('mongodb');
var userlist = require('/home/ubuntu/pacemaker/app/user_list');
var goalclonelist = require('/home/ubuntu/pacemaker/app/goal_clone_list');
var goallist = require('/home/ubuntu/pacemaker/app/goal_list');
var chatroomlist = require('/home/ubuntu/pacemaker/app/chatroom_list');

//var index = require('./routes/index');
//var users = require('./routes/users');

var api_key = 'AAAAOvCEnQQ:APA91bHN655VpqardvGu6Z2lDohO07OlJOCIOdBOOz8MY6LbYbngpSqyuf76MHB8mIsCviWL0zq506JVwLEjutqJy7-epgsofGR-tXt-WVb5KgsIMCVIx4nKZwI00rQ8rsxbowrggNBk';
var fcm = new FCM(api_key);

var http_protocol = 'http://';
var server_address = '52.78.200.87:3000';
var img_write_path = '/public/images/';
var img_access_path = '/static/images/';
var img_file_prefix = 'img_';

var app = express();

var db = mongoose.connection;
db.on('error', console.error);
db.once('open', function(){
        // CONNECTED TO MONGODB SERVER
        console.log("Connected to mongod server");
      });

mongoose.connect('mongodb://localhost/pacemaker');


// view engine setup
//app.set('views', path.join(__dirname, 'views'));
//app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use('/static', express.static(path.join(__dirname, 'public')));

//app.use('/', index);
//app.use('/users', users);

var server = app.listen(port);
console.log('The App runs on port ' + port);
var io = require('socket.io')(server);
io.on('connection', function (socket) {
  socket.on('user joined', function(username, roomname, roomid){
    // add participant info in chatroomlist
    chatroomlist.findOne({_id : roomid}, function(err, room){
      room.update({people : room.people + 1}, function(err){
        socket.username = username;
        socket.room = roomname;
        socket.join(roomname);
        socket.broadcast.to(socket.room).emit('user joined', {
          username: socket.username
        });
        chatroomlist.find(function(err, objs){
          io.emit('room changed', {
            chatrooms : objs
          });
        });
      });
    });
  });

  // this should be modified
  socket.on('new message', function(usertoken, msg){
    userlist.findOne({token : usertoken}, function(err, user){
      socket.broadcast.to(socket.room).emit('new message', {
        username: socket.username,
        message: msg,
        photo: user.photo,
        token: usertoken,
      });

    });
  });

  socket.on('member info', function(roomid){
    chatroomlist.findOne({_id : roomid}, function(err, obj){
      tokens = obj.participant_token;
      userlist.find({token: {$in: tokens}}, function(err, objs){
        socket.emit('member info', {
          participants : objs
        });
      });
    });
  });

  socket.on('exit', function(token, roomid){
    chatroomlist.findOne({_id : roomid}, function(err, room){
      room.update({people : room.people - 1}, function(err){
        if(err) console.log(err);
        userlist.findOne({token: token}, function(err, obj){
          socket.broadcast.to(socket.room).emit('exit info', {
            username : obj.name
          });
          chatroomlist.find(function(err, objs){
            io.emit('room changed', {
              chatrooms : objs
            });
          });
        });
      });
    });
  });
});

app.get('/', function(req, res, next) {
 res.end('');
});

app.post('/user_login', function(req, res, next) {
  var json = req.body;
  console.log('USER_LOGIN');
  console.log(json);

  var token = json.token;

  userlist.findOne({token : token}, function(err, obj) {
    if (err) return next(err);
    if (obj == null) {
      console.log('login failed')
      res.json({result:'failed'});
      return;
    } else {
      console.log('login success');
      var resJson =_.extend({result:'success'}, {obj});
      console.log(resJson);
      res.json(resJson);
      return;
    }
  });
});

app.post('/user_register', function(req, res, next) {
  var json = req.body;
  console.log('USER_REGISTER');
  console.log(json);

  var name = json.name;
  console.log('A');
  var photo = saveImageSync(json.photo);
  console.log(photo);
  console.log('B');
  var goals_titles = json.goals_titles;
  var goals_id = json.goals_id;
  var token = json.token;

  var new_user = new userlist();
  new_user.name = name;
  new_user.photo = photo;
  new_user.goals_title = goals_titles;
  new_user.goals_id = goals_id;
  new_user.token = token;

  console.log(new_user);

  new_user.save(function(err, new_user) {
    if (err) return next(err);
    console.log('new user successfully created');
    res.json({result:'success'});
  });
});

app.post('/get_todo', function(req, res){
  var token = req.body.token;

  userlist.findOne({token : token}, function(err, obj){
    var goal_titles = obj.goals_title;
    console.log(goal_titles);
    goalclonelist.find({owner_token : token}, function(err, objs){
      if(err) console.log(err);
      console.log("successfully found goal clones");
      res.json({result: 'success', goals: objs, titles: goal_titles, user: obj});
    });
  });
});

app.post('/get_remove_clone_todo', function(req, res){
  var cid = req.body.cid;
  var index = req.body.index;

  goalclonelist.findOne({_id : cid}, function(err, obj){
    if(err) console.log(err);
    console.log("successfully found goal clones");
    obj.update({todo : obj.todo.splice(index, 1)}, function(err){
      if(err) console.log(err);
      res.json({result : 'success'});
    });
  });
});

app.post('/get_remove_clone_routine', function(req, res){
  var cid = req.body.cid;
  var day = req.body.day;
  var index = req.body.index;

  goalclonelist.findOne({_id : cid}, function(err, clone){
    if(err) console.log(err);
    console.log("successfully found goal clones");
    switch(day){
      case 0:
      clone.update({mon : clone.mon.splice(index, 1)}, function(err){
        if(err) console.log(err);
        console.log("Added new routine to clone!");
        res.json({result : 'success'});
      });
      break;
      case 1:
      clone.update({tue : clone.tue.splice(index, 1)}, function(err){
        if(err) console.log(err);
        console.log("Added new routine to clone!");
        res.json({result : 'success'});
      });
      break;
      case 2:
      clone.update({wed : clone.wed.splice(index, 1)}, function(err){
        if(err) console.log(err);
        console.log("Added new routine to clone!");
        res.json({result : 'success'});
      });
      break;
      case 3:
      clone.update({thu : clone.thu.splice(index, 1)}, function(err){
        if(err) console.log(err);
        console.log("Added new routine to clone!");
        res.json({result : 'success'});
      });
      break;
      case 4:
      clone.update({fri : clone.fri.splice(index, 1)}, function(err){
        if(err) console.log(err);
        console.log("Added new routine to clone!");
        res.json({result : 'success'});
      });
      break;
      case 5:
      clone.update({sat : clone.sat.splice(index, 1)}, function(err){
        if(err) console.log(err);
        console.log("Added new routine to clone!");
        res.json({result : 'success'});
      });
      break;
      case 6:
      clone.update({sun : clone.sun.splice(index, 1)}, function(err){
        if(err) console.log(err);
        console.log("Added new routine to clone!");
        res.json({result : 'success'});
      });
      break;


    }
  });
});

app.post('/get_remove_clone_memo', function(req, res){
  var cid = req.body.cid;
  var index = req.body.index;

  goalclonelist.findOne({_id : cid}, function(err, obj){
    if(err) console.log(err);
    console.log("successfully found goal clones");
    obj.update({todo : obj.memo.splice(index, 1)}, function(err){
      if(err) console.log(err);
      res.json({result : 'success'});
    });
  });
});

app.post('/get_remove_clone', function(req, res){
  var cid = req.body.cid;
  goalclonelist.findOneAndRemove({_id : cid}, function(err){
    if(err) console.log(err);
    res.json({result : 'success'});
  });
});


app.post('/update_clone_location', function(req, res){
  var cid = req.body.cid;
  var latitude = req.body.latitude;
  var longitude = req.body.longitude;
  console.log(req.body);

  goalclonelist.findOneAndUpdate({_id : cid}, {latitude : latitude, longitude : longitude}, function(err){
    if(err) console.log(err);
    res.json({result : 'success'});
  });

});


app.post('/new_goal_register', function(req, res, next) {
  var json = req.body;
  console.log('new_goal_register');
  console.log(json);
  var photo = saveImageSync(json.photo);

  var new_goal = new goallist({
    title: json.title,
    owner_token: json.token,
    mon: json.mon,
    tue: json.tue,
    wed: json.wed,
    thu: json.thu,
    fri: json.fri,
    sat: json.sat,
    sun: json.sun,
    dateFrom: json.dateFrom,
    dateTo: json.dateTo,
    numPeople: 1,
    participant_token: [json.token],
    latitude: json.latitude,
    longitude: json.longitude,
    public: json.public,
    description: json.description,
    photo: photo, 

  });
  new_goal.save(function(err, obj) {
    if (err) console.error(err);
    console.log('new goal register complete!');
    console.log('new goal info : ' + obj.title);
    var new_clone = new goalclonelist({
      pid: obj._id,
      title: json.title,
      todo: [],
      owner_token: json.token,
      mon: json.mon,
      tue: json.tue,
      wed: json.wed,
      thu: json.thu,
      fri: json.fri,
      sat: json.sat,
      sun: json.sun,
      dateFrom: json.dateFrom,
      dateTo: json.dateTo,
      latitude: json.latitude,
      longitude: json.longitude,
      public: json.public,
      memo: [],
      photo: photo, 
    });
    new_clone.save(function(err, obj_clone) {
      if (err) console.error(err);
      console.log('new goal clone register complete!');
      console.log('new goal clone info : ' + obj.title);
      userlist.findOne({token : json.token}, function(err, user){
        if (err) console.error(err);
        user.update({goals_title : user.goals_title.concat([json.title]), goals_id : user.goals_id.concat([obj_clone._id])}, function(err){
          if (err) console.error(err);
          res.json({result: 'success', pid: obj._id, cid: obj_clone._id});
        });
      });
    });
  });
});

app.post('/new_chat', function(req, res) {
  var js = req.body;
  var name = js.title;
  var token = js.token;
  var pid = js.pid;
  var color = js.color;

  var chatroom = new chatroomlist();
  chatroom.pid = pid;
  chatroom.title = name;
  chatroom.color = color;
  chatroom.people = 0;
  chatroom.participant_token = [token];
  chatroom.save(function(err, new_chatroom) {
    if (err) console.error(err);
    console.log('new chatroom register complete!');
    console.log('new chatroom info : ' + new_chatroom.title);
    res.json({'result' : 'success', new_chat : new_chatroom});
  });
});

app.post('/get_chatroom', function(req, res){
  var pid = req.body.pid;

  chatroomlist.find({pid : pid}, function(err, objs){
    if(err) console.log(err);
    res.json({result : 'success', chatrooms : objs});
  });
});

app.post('/get_clone_list', function(req, res){
  var pid = req.body.pid;

  goalclonelist.find({pid : pid}, function(err, objs){
    if(err) console.log(err);
    res.json({result : 'success', clones : objs});
  });
});

app.post('/check_register', function(req, res){
  var token = req.body.token;
  var pid = req.body.pid;

  userlist.findOne({token : token}, function(err, user){
    var cloneids = user.goals_id;
    goalclonelist.find({_id : {$in : cloneids}}, function(err, clones){
      var registered = false;
      for(var i = 0 ; i < clones.length ; i++){
        if(clones[i].pid === pid){
          registered = true;
          break;
        }
      }
      res.json({result : 'success', bool : registered});
    });
  });
});

app.post('/goal_list', function(req, res){

  goallist.find(function(err, goals){
    if(err) console.log(err);
    console.log("found goals!");
    console.log(goals);
    res.json({result : 'success', 'goals' : goals});
  });
});

app.post('/goal_clone_info', function(req, res){
  var cid = req.body.cid;
  console.log("cid : " + cid);
  goalclonelist.findOne({_id : cid}, function(err, clone){
    if(err) console.log(err);
    console.log("found clone!");
    console.log(clone);
    res.json({result : 'success', 'clone' : clone});
  });
});

app.post('/goal_info', function(req, res){
  var pid = req.body.pid;
  console.log("pid : " + pid);
  goallist.findOne({_id : pid}, function(err, goal){
    if(err) console.log(err);
    console.log("found goal!");
    console.log(goal);
    userlist.find({token: {$in: goal.participant_token}}, function(err, objs){
      if(err) console.log(err);
      console.log("found participants!");
      res.json({result : 'success', 'goal' : goal, 'participants' : objs});
    });
  });
});

app.post('/user_info', function(req, res){
  var token = req.body.token;
  userlist.findOne({token : token}, function(err, user){
    if(err) console.log(err);
    console.log("found user!");
    res.json({result : 'success', 'user' : user});
  });
});

app.post('/user_follow', function(req, res){
  var token = req.body.token;
  var pid = req.body.pid;
  goallist.findOne({_id : pid}, function(err, goal){
    if(err) console.log(err);
    console.log("found goal!");
    console.log(goal);
    goal.update({numPeople : goal.numPeople + 1 , participant_token : goal.participant_token.concat([token])}, function(err){
      var new_clone = new goalclonelist({
        pid: pid,
        title: goal.title,
        todo: [],
        owner_token: token,
        mon: goal.mon,
        tue: goal.tue,
        wed: goal.wed,
        thu: goal.thu,
        fri: goal.fri,
        sat: goal.sat,
        sun: goal.sun,
        dateFrom: goal.dateFrom,
        dateTo: goal.dateTo,
        latitude: goal.latitude,
        longitude: goal.longitude,
        public: goal.public,
        memo: [],
        photo: goal.photo, 
      });
      new_clone.save(function(err, clone) {
        if (err) return console.error(err);
        console.log('new clone register complete!');
        console.log('new clone info : ' + clone);
        userlist.findOne({token : token}, function(err, user){
          if(err) console.log(err);
          console.log("found user!");
          user.update({goals_title : user.goals_title.concat([goal.title]), goals_id : user.goals_id.concat([clone._id])}, function(err){
            if(err) console.log(err);
            console.log("cloning complete " + user);
            res.json({result : 'success', cid : clone._id});
          });
        });
      });
    });
  });
});

app.post('/add_todo', function(req, res){
  var cid = req.body.cid;
  var new_todo = req.body.new_todo;

  goalclonelist.findOne({_id : cid}, function(err, clone){
    if(err) console.log(err);
    clone.update({todo : clone.todo.concat([new_todo])}, function(err){
      if(err) console.log(err);
      console.log("Added new todo to clone!");
      res.json({result : 'success'});
    });
  });
});

app.post('/add_memo', function(req, res){
  var cid = req.body.cid;
  var new_memo = req.body.new_memo;

  goalclonelist.findOne({_id : cid}, function(err, clone){
    if(err) console.log(err);
    clone.update({memo : clone.memo.concat([new_memo])}, function(err){
      if(err) console.log(err);
      console.log("Added new memo to clone!");
      res.json({result : 'success'});
    });
  });
});

app.post('/add_routine', function(req, res){
  console.log(req.body);
  var cid = req.body.cid;
  var new_routine = req.body.new_routine;
  var day = req.body.day;

  goalclonelist.findOne({_id : cid}, function(err, clone){
    if(err) console.log(err);
    switch(day){
      case 0:
      clone.update({mon : clone.mon.concat([new_routine])}, function(err){
        if(err) console.log(err);
        console.log("Added new routine to clone!");
        res.json({result : 'success'});
      });
      break;
      case 1:
      clone.update({tue : clone.tue.concat([new_routine])}, function(err){
        if(err) console.log(err);
        console.log("Added new routine to clone!");
        res.json({result : 'success'});
      });
      break;
      case 2:
      clone.update({wed : clone.wed.concat([new_routine])}, function(err){
        if(err) console.log(err);
        console.log("Added new routine to clone!");
        res.json({result : 'success'});
      });
      break;
      case 3:
      clone.update({thu : clone.thu.concat([new_routine])}, function(err){
        if(err) console.log(err);
        console.log("Added new routine to clone!");
        res.json({result : 'success'});
      });
      break;
      case 4:
      clone.update({fri : clone.fri.concat([new_routine])}, function(err){
        if(err) console.log(err);
        console.log("Added new routine to clone!");
        res.json({result : 'success'});
      });
      break;
      case 5:
      clone.update({sat : clone.sat.concat([new_routine])}, function(err){
        if(err) console.log(err);
        console.log("Added new routine to clone!");
        res.json({result : 'success'});
      });
      break;
      case 6:
      clone.update({sun : clone.sun.concat([new_routine])}, function(err){
        if(err) console.log(err);
        console.log("Added new routine to clone!");
        res.json({result : 'success'});
      });
      break;


    }
    return;
  });
});


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

function decodeBase64Image(dataString) {
  var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),response = {};

  if (matches.length !== 3) {
    return new Error('Invalid input string');
  }

  response.type = matches[1];
  response.data = new Buffer(matches[2], 'base64');

  return response;
}

function getImageContainer(dataString) {
  var header = dataString.substring(0,30);
  var end = header.indexOf(';base64,');
  var start = 'data:image/'.length;
  return '.' + header.substring(start, end);
}

function randomInt (low, high) {
  return Math.floor(Math.random() * (high - low) + low);
}

function saveImageSync(base64Data) {
  console.log('BASE64DATA : ' + base64Data)
  var start = randomInt(35, 40);
  var end = randomInt(50, 55);
  var chunk = base64Data.substring(start, end);

  var md5sum = crypto.createHash('md5');
  var hashStr = md5sum.update(chunk).digest('hex');

  var imageBuffer = decodeBase64Image(base64Data);
  var filetype = getImageContainer(base64Data);
  var filename = img_file_prefix + Date.now() + hashStr + filetype;
  var filepath = __dirname + img_write_path + filename;
  console.log(filepath);
  console.log(decodeBase64Image(base64Data).data);
  fs.writeFileSync(filepath, imageBuffer.data);
  console.log('D');
  var url = http_protocol + server_address + img_access_path + filename;

  return url; 
}

module.exports = app;
