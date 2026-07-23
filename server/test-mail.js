import nodemailer from 'nodemailer';
const transporter = nodemailer.createTransport({
  host: '172.31.0.153',
  port: 25,
  secure: false,
  ignoreTLS: true,
  name: 'pulse.enpf.kz',
  tls: { rejectUnauthorized: false }
});
transporter.verify((err, success) => {
  if (err) console.error(err);
  else console.log('SUCCESS');
});
