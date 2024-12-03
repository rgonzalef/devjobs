const mongoose = require('mongoose')
const Vacante = mongoose.model('Vacante')
const multer = require('multer')
const shortid = require('shortid')
const { cerrarSesion } = require('./authController')

exports.formularioNuevaVacante = (req, res) => {
  res.render('nueva-vacante', {
    nombrePagina: 'NuevaVacante',
    tagline: 'Llena el formulario y publica tu vacante',
    cerrarSesion: true,
    nombre: req.user.nombre,
    imagen: req.user.imagen,
  })
}

// agrega las vacantes a la base de datos
exports.agregarVacante = async (req, res) => {
  const vacante = new Vacante(req.body)

  // usuario autor de la vacante
  vacante.autor = req.user._id

  // crear arreglo de habilidades (skills)
  vacante.skills = req.body.skills.split(',')

  // almacenarlo en la base de datos
  const nuevaVacante = await vacante.save()

  // redireccionar
  res.redirect(`/vacantes/${nuevaVacante.url}`)
}

//muestra una vacante
exports.mostrarVacante = async (req, res, next) => {
  const vacante = await Vacante.findOne({ url: req.params.url })
    .lean()
    .populate('autor')

  //si no hay resultados
  if (!vacante) return next()
  res.render('vacante', {
    vacante,
    nombrePagina: vacante.titulo,
    barra: true,
  })
}

exports.formEditarVacante = async (req, res, next) => {
  const vacante = await Vacante.findOne({ url: req.params.url }).lean()

  //si no hay resultados
  if (!vacante) return next()
  res.render('editar-vacante', {
    vacante,
    nombrePagina: `Editar - ${vacante.titulo}`,
    cerrarSesion: true,
    nombre: req.user.nombre,
    imagen: req.user.imagen,
  })
}
exports.editarVacante = async (req, res) => {
  const vacanteActualizada = req.body

  vacanteActualizada.skills = req.body.skills.split(',')

  const vacante = await Vacante.findOneAndUpdate(
    { url: req.params.url },
    vacanteActualizada,
    {
      new: true,
      runValidators: true,
    }
  )

  res.redirect(`/vacantes/${vacante.url}`)
}

//validar y sanitizar los campos de las nuevas vacantes

exports.validarVacante = (req, res, next) => {
  //sanitizar los campos
  req.sanitizeBody('titulo').escape()
  req.sanitizeBody('empresa').escape()
  req.sanitizeBody('ubicacion').escape()
  req.sanitizeBody('salario').escape()
  req.sanitizeBody('contrato').escape()
  req.sanitizeBody('skills').escape()

  //validar
  req.checkBody('titulo', 'Agrega un titulo a la vacante').notEmpty()
  req.checkBody('empresa', 'Agrega una empresa').notEmpty()
  req.checkBody('ubicacion', 'Agrega una ubicación').notEmpty()
  req.checkBody('contrato', 'Selecciona el tipo de contrato').notEmpty()
  req.checkBody('skills', 'Agrega al menos una habilidad').notEmpty()

  const errores = req.validationErrors()

  if (errores) {
    req.flash(
      'error',
      errores.map((error) => error.msg)
    )

    res.render('nueva-vacante', {
      nombrePagina: 'NuevaVacante',
      tagline: 'Llena el formulario y publica tu vacante',
      cerrarSesion: true,
      nombre: req.user.nombre,
      mensajes: req.flash(),
    })
    return
  }

  next() //siguiente middleware
}

exports.eliminarVacante = async (req, res) => {
  const { id } = req.params

  try {
    const vacante = await Vacante.findById(id)

    if (!vacante) {
      return res.status(404).send('Vacante no encontrada')
    }

    if (verificarAutor(vacante, req.user)) {
      // Si este es el usuario, se puede eliminar
      await vacante.deleteOne()
      return res.status(200).send('Vacante eliminada correctamente')
    } else {
      // No permitido
      return res
        .status(403)
        .send('No tienes permiso para eliminar esta vacante')
    }
  } catch (error) {
    console.error(error)
    return res.status(500).send('Error interno del servidor')
  }
}

const verificarAutor = (vacante = {}, usuario = {}) => {
  if (!vacante.autor.equals(usuario._id)) {
    return false
  }
  return true
}

//subir cv en pdf
exports.subirCV = (req, res, next) => {
  upload(req, res, function (error) {
    if (error) {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          req.flash('error', 'El archivo es muy grande: Máximo 100kb')
        } else {
          req.flash('error', error.message)
        }
      } else {
        req.flash('error', error.message)
      }
      res.redirect('back')
      return
    } else {
      return next()
    }
  })
}

//opciones de Multer

const configuracionMulter = {
  limits: { fileSize: 100000 },
  storage: (fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, __dirname + '../../public/uploads/cv')
    },
    filename: (req, file, cb) => {
      const extension = file.mimetype.split('/')[1]
      cb(null, `${shortid.generate()}.${extension}`)
    },
  })),
  fileFilter(req, file, cb) {
    if (file.mimetype === 'application/pdf') {
      //el callback se ejecuta como true o false : true cuando la imagen se acepta
      cb(null, true)
    } else {
      cb(new Error('Formato no valido'), false)
    }
  },
}

const upload = multer(configuracionMulter).single('cv')

exports.contactar = async (req, res, next) => {
  const vacante = await Vacante.findOne({ url: req.params.url })

  //si no existe vacante
  if (!vacante) return next()

  //todo bien, construir el nuevo objeto
  const nuevoCandidato = {
    nombre: req.body.nombre,
    email: req.body.email,
    cv: req.file.filename,
  }

  //almacenar la vacante
  vacante.candidatos.push(nuevoCandidato)
  await vacante.save()

  //mensaje flash y redirección
  req.flash('correo', 'Se envio tu CV correctamente')
  res.redirect('/')
}

exports.mostrarCandidatos = async (req, res, next) => {
  const vacante = await Vacante.findById(req.params.id)

  if (vacante.autor != req.user._id.toString()) {
    return next()
  }
  if (!vacante) return next()

  res.render('candidatos', {
    nombrePagina: `Candidatos Vacante - ${vacante.titulo}`,
    cerrarSesion: true,
    nombre: req.user.nombre,
    imagen: req.user.imagen,
    candidatos: vacante.candidatos,
  })
}

//buscador de vacantes

exports.buscarVacantes = async (req, res) => {
  const vacantes = await Vacante.find({
    $text: {
      $search: req.body.q,
    },
  }).lean()

  // Mostrar las vacantes
  res.render('home', {
    nombrePagina: `Resultados para la búsqueda : ${req.body.q}`,
    barra: true,
    vacantes,
  })
}
