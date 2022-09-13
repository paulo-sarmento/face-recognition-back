import Express from "express";
import BodyParser from "body-parser";
import Cors from "cors";
import Knex from "knex";
import Bcrypt from "bcrypt";
import Clarifai from 'clarifai';

const db = Knex({
  client: 'pg',
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  }
});

const app = Express();
app.use(BodyParser.json());
app.use(Cors());

const ClarifaiApp = new Clarifai.App({
  apiKey: process.env.API_CLARIFAI
});

app.get("/", (req, res) => {
  res.send("it is working")
})

app.post("/imageurl", (req, res) => {
  ClarifaiApp.models
    .predict(Clarifai.FACE_DETECT_MODEL, req.body.input)
    .then(data => {
      res.json(data);
    })
    .catch(err => res.status(400).json('unable to work with API'))
})

app.post("/signin", (req, res) => {
  const { email, password } = req.body

  if(!email || !password) {
    return res.status(400).json('incorrect form submission');
  }
  db.select('email', 'hash').from('login')
    .where('email', '=', email)
    .then(data => {
      const isValid = Bcrypt.compareSync(password, data[0].hash);
      if(isValid) {
        return db.select('*').from('users')
          .where('email', '=', email)
          .then(user => {
            res.json(user[0])
          })
          .catch(err => res.status(400).json('unable to get user'))
      } else {
        res.status(400).json('wrong credentials')
      }
    })
    .catch(err => res.status(400).json('wrong credentials'))
})

app.post("/register", (req, res) => {
  const { name, email, password } = req.body;

  if(!name || !email || !password) {
    return res.status(400).json('incorrect form submission');
  }

  const hash = Bcrypt.hashSync(password, 10);
  db.transaction(trx => {
    trx.insert({hash, email})
    .into('login')
    .returning('email')
    .then(loginEmail => {
      return trx('users')
        .returning('*')
        .insert({
          email: loginEmail[0].email,
          name,
          joined: new Date()
        })
        .then(user => {
          res.json(user[0])
        })
    })
  .then(trx.commit)
  .catch(trx.rollback)
  })
  .catch(err => res.status(400).json('unable to register'))

})

app.get("/profile/:id", (req, res) => {
  const { id } = req.params;
  db('users').where({id})
    .then(user => {
      if(user.length) {
        res.json(user[0])
      } else {
        res.status(400).json('Not found')
      }
    })
})

app.put("/image", (req, res) => {
  const { id } = req.body;
  db('users').where('id', '=', id)
    .increment('entries', 1)
    .returning('entries')
    .then(entries => {
      res.json(entries[0].entries);
    })
    .catch(err => res.status(400).json('unable to get entries'))
})

app.listen(process.env.PORT || 3000, () => {
  console.log(`server is running on port ${process.env.PORT}`)
});
