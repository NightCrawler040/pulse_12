import nodemailer from 'nodemailer';
const transporter = nodemailer.createTransport({
  host: '172.31.0.153',
  port: 25,
  secure: false,
  ignoreTLS: true,
  name: 'pulse.enpf.kz',
  tls: { rejectUnauthorized: false }
});

async function run() {
  try {
    const info = await transporter.sendMail({
      from: 'pulse@enpf.kz',
      to: 'b.kairatov@enpf.kz',
      subject: '“естовое письмо от Pulse 12 ??',
      text: 'ѕривет! Ёто тестовое письмо отправлено напр€мую с машины разработчика (где IP адрес не заблокирован). ≈сли вы читаете это письмо, значит сам почтовый сервер работает отлично, и проблема на 100% заключаетс€ в блокировке IP-адреса вашего сервера (172.31.71.55) на стороне FortiMail.',
      html: '<h3>ѕривет! Ёто тестовое письмо от Pulse 12 ??</h3><p>ќно отправлено напр€мую с машины разработчика (где IP адрес не заблокирован).</p><p>≈сли вы читаете это письмо, значит сам почтовый сервер работает отлично, и проблема на 100% заключаетс€ в блокировке IP-адреса вашего сервера (<strong>172.31.71.55</strong>) на стороне FortiMail.</p>'
    });
    console.log('SUCCESS: ' + info.messageId);
  } catch (err) {
    console.error('ERROR:', err);
  }
}
run();
