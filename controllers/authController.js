const passport = require('passport')
const mongoose = require('mongoose')
const Vacante = mongoose.model('Vacante')
const Usuarios = mongoose.model('Usuarios')
const crypto = require('crypto')
const enviarEmail = require('../handlers/email')

exports.autenticarUsuario = passport.authenticate('local', {
  successRedirect: '/administracion',
  failureRedirect: '/iniciar-sesion',
  failureFlash: true,
  badRequestMessage: 'Ambos campos son obligatorios',
})

// Revisar si el usuario esta autenticado o no
exports.verificarUsuario = (req, res, next) => {
  // revisar el usuario
  if (req.isAuthenticated()) {
    return next() // estan autenticados
  }

  // redireccionar
  res.redirect('/iniciar-sesion')
}

exports.mostrarPanel = async (req, res) => {
  //consultar el usuario autenticado
  const vacantes = await Vacante.find({ autor: req.user._id }).lean()

  res.render('administracion', {
    nombrePagina: 'Panel de Administración',
    tagline: 'Crea y administra tus vacantes desde aquí',
    cerrarSesion: true,
    nombre: req.user.nombre,
    imagen: req.user.imagen,
    vacantes,
  })
}

exports.cerrarSesion = (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err)
    }
    req.flash('correcto', 'Cerraste sesión correctamente')
    return res.redirect('/iniciar-sesion')
  })
}

//Formulario para reestablecer password
exports.formReestablecerPassword = (req, res) => {
  res.render('reestablecer-password', {
    nombrePagina: 'Reestablece tu Password',
    tagline:
      'Si ya tienes una cuenta pero olvidaste tu password, coloca tu email',
  })
}

exports.enviarToken = async (req, res) => {
  const usuario = await Usuarios.findOne({ email: req.body.email })

  if (!usuario) {
    req.flash('error', 'No existe esa cuenta')
    return res.redirect('/iniciar-sesion')
  }

  //el usuario existe, generar token
  usuario.token = crypto.randomBytes(20).toString('hex')
  usuario.expira = Date.now() + 3600000

  //guardar el usuario
  await usuario.save()
  const resetUrl = `http://${req.headers.host}/reestablecer-password/${usuario.token}`

  console.log(resetUrl)
  //console.log(usuario)

  //enviar notificaciones por email
  await enviarEmail.enviar({
    usuario,
    subject: 'Password Reset',
    resetUrl,
    archivo: 'reset',
  })

  req.flash('correcto', 'Revisa tu email para la indicaciones')
  res.redirect('/iniciar-sesion')
}

//valida si el token es valido y el usuario existe, muestra la vista

exports.reestablecerPassword = async (req, res) => {
  const usuario = await Usuarios.findOne({
    token: req.params.token,
    expira: {
      $gt: Date.now(),
    },
  })

  if (!usuario) {
    req.flash('error', 'El formulario ya no es valido, intenta de nuevo')
    return res.redirect('/reestablecer-password')
  }

  //todo bien, mostrar el formulario
  res.render('nuevo-password', {
    nombrePagina: 'Nuevo Password',
  })
}

//almacena el nuevo password en la BD
exports.guardarPassword = async (req, res) => {
  const usuario = await Usuarios.findOne({
    token: req.params.token,
    expira: {
      $gt: Date.now(),
    },
  })

  //no existe el usuario o el token es invalido
  if (!usuario) {
    req.flash('error', 'El formulario ya no es valido, intenta de nuevo')
    return res.redirect('/reestablecer-password')
  }

  //asignar nuevo pass, limpiar valores previos
  usuario.password = req.body.password
  usuario.token = undefined
  usuario.expira = undefined

  //agregar y eliminar valores del objeto
  //console.log(usuario)
  await usuario.save()

  //redirigir
  req.flash('correcto', 'Password modificado correctamente')
  res.redirect('/iniciar-sesion')
}
