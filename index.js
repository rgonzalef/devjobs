const mongoose = require('mongoose')
require('./config/db')

const express = require('express')
const exphbs = require('express-handlebars')
const path = require('path')
const router = require('./routes')
const cookieParser = require('cookie-parser')
const session = require('express-session')
const MongoStore = require('connect-mongo')
const bodyParser = require('body-parser')
const expressValidator = require('express-validator')
const flash = require('connect-flash')
const createError = require('http-errors')
const passport = require('./config/passport')

require('dotenv').config({ path: 'variables.env' })

const app = express()

//habilitar body-parser
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

//validación de campos
app.use(expressValidator())

//habilitar handlebars como view
app.engine(
  'handlebars',
  exphbs.engine({
    defaultLayout: 'layout',
    helpers: require('./helpers/handlebars'),
    runtimeOptions: {
      allowProtoPropertiesByDefault: true,
      allowProtoMethodsByDefault: true,
    },
  })
)
app.set('view engine', 'handlebars')

//static files
app.use(express.static(path.join(__dirname, 'public')))

app.use(cookieParser())

app.use(
  session({
    secret: process.env.SECRET,
    key: process.env.KEY,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.DATABASE }),
  })
)

//inicializar passport
app.use(passport.initialize())
app.use(passport.session())

//alertas y flash messages
app.use(flash())

//crear nuestro middleware
app.use((req, res, next) => {
  res.locals.mensajes = req.flash()
  next()
})

app.use('/', router())

//404 página no existente
app.use((req, res, next) => {
  next(createError(404, 'No encontrado'))
})

//administración de los errores
app.use((error, req, res) => {
  res.locals.mensaje = error.message
  const status = error.status || 500
  res.locals.status = status
  res.status(status)
  res.render('error')
})

//dejar que Heroku asigne el puerto
const host = '0.0.0.0'
const port = process.env.PORT

app.listen(port, host, () => {
  console.log('El servidor esta funcionando')
})
