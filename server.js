'use strict';

const Hapi = require('hapi');
const Boom = require('boom');
const Good = require('good');
const SpeechToTextV1 = require('watson-developer-cloud/speech-to-text/v1');
const LanguageTranslatorV2 = require('watson-developer-cloud/language-translator/v2');
const fs = require('fs');
require('dotenv').config()

const server = new Hapi.Server();
server.connection({ port: 3001, host: 'localhost' });

server.route({
  method: 'GET',
  path: '/',
  handler: function(request, reply) {
    let speech_to_text = new SpeechToTextV1({
      username: process.env.WATSON_STT_USER,
      password: process.env.WATSON_STT_PASS
    });

    let language_translator = new LanguageTranslatorV2({
      username: process.env.WATSON_TRA_USER,
      password: process.env.WATSON_TRA_PASS,
      url: 'https://gateway.watsonplatform.net/language-translator/api/'
    });

    // Example 1
    // let params = {
    //   audio: fs.createReadStream('./tt_example.wav'),
    //   content_type: 'audio/l16; rate=44100',
    //   model: 'en-US_BroadbandModel'
    // };

    // speech_to_text.recognize(params, function(err, res) {
    //   if (err) {
    //     console.log(err);
    //   } else {
    //     console.log(JSON.stringify(res, null, 2));
    //   }
    // });

    // Example 2
    // let params = {
    //   content_type: 'audio/l16; rate=44100',
    //   model: 'en-US_BroadbandModel'
    // };

    // fs.createReadStream('./tt_example.wav')
    //   .pipe(speech_to_text.createRecognizeStream(params))
    //   .pipe(fs.createWriteStream('./transcription.txt'));

    // Example 3
    let params = {
      content_type: 'audio/l16; rate=44100',
      model: 'en-US_BroadbandModel'
    };

    let transcript = '';
    let recognizeStream = speech_to_text.createRecognizeStream(params);
    fs.createReadStream('./tt_example.wav').pipe(recognizeStream);
    recognizeStream.setEncoding('utf8');
    recognizeStream.on('data', function(event) { onEvent('data', event); });
    recognizeStream.on('results', function(event) { onEvent('results', event); });
    recognizeStream.on('end', function(event) { onEvent('end', event); });
    recognizeStream.on('error', function(event) { onEvent('error', event); });
    recognizeStream.on('close', function(event) { onEvent('close', event); });

    function onEvent(name, event) {
      if (name == 'results') {
        // console.log(JSON.stringify(event.results, null, 2));
        let currentTranscript = JSON.stringify(event.results[0].alternatives[0].transcript, null, 1);
        currentTranscript = currentTranscript.replace(/(")/g, '')
        console.log(currentTranscript);
        let textTimestamps = event.results[0].alternatives[0].timestamps;
        console.log(textTimestamps);
        if (event.results[0].final === true) {
          transcript += currentTranscript;
        }
      } else if (name == 'end') {
        console.log('end');
      } else if (name == 'error') {
        console.log(event);
      } else if (name == 'close') {
        fs.writeFile("./transcript.txt", transcript, function(err) {
          if(err) {
              return console.log(err);
          }

          console.log("The transcript has been saved.");
        });

        language_translator.translate({
          text: transcript, source : 'en', target: 'es' },
          function (err, translation) {
            if (err) {
              console.log('error:', err);
            } else {
              fs.writeFile("./translation.txt", translation.translations[0].translation, function(err) {
                if(err) {
                    return console.log(err);
                }
                console.log("The translation has been saved.");
              });
            }
        });

        console.log('close');
      }
    }

    reply({ project: 'tt_hapi' });
  }
})

server.register({
  register: Good,
  options: {
    reporters: {
        console: [{
            module: 'good-squeeze',
            name: 'Squeeze',
            args: [{
                response: '*',
                log: '*'
            }]
        }, {
            module: 'good-console'
        }, 'stdout']
    }
  }
}, (err) => {
  if (err) {
    throw err; // something bad happened loading the plugin
  }

  server.start((err) => {
    if (err) {
      throw err;
    }

    server.log('info', 'Server running at: ' + server.info.uri);
  });
});