# Bazdid

مانیتور بسیار ساده و بی‌صدا برای باز کردن واقعی صفحه اصلی وب‌سایت‌ها با Chromium و خواندن DOM و متن رندرشده هر ۶۰ ثانیه.

## سایت‌های فعلی

- https://shafano.ir/
- https://khesaratino.ir/
- https://redcoweb.ir/
- https://belitino.ir/

## رفتار برنامه

برای هر سایت، برنامه با Playwright/Chromium صفحه اصلی را واقعاً باز می‌کند، JavaScript و assetهای صفحه را مانند مرورگر معمولی بارگذاری می‌کند، تا پایین صفحه اسکرول می‌کند تا lazy-loadها فرصت اجرا داشته باشند و سپس موارد زیر را از DOM نهایی می‌خواند:

- HTTP status
- `document.title`
- کل `document.body.innerText`
- کل `document.documentElement.outerHTML`
- تعداد عناصر DOM
- حجم HTML
- طول متن قابل مشاهده
- hash متن رندرشده

HTTP 200 به تنهایی سالم محسوب نمی‌شود. صفحه سفید، متن بسیار کم، DOM ناقص، کاهش شدید محتوا نسبت به baseline یا Error Page با وضعیت `CONTENT_ERROR` تشخیص داده می‌شود.

برنامه عمداً هیچ لاگی تولید نمی‌کند، چیزی در فایل ذخیره نمی‌کند و `console.log`/`console.error` ندارد. وضعیت آخر فقط در حافظه پردازش نگهداری می‌شود.

## نصب روی Ubuntu 24.04

```bash
sudo apt update
sudo apt install -y git nodejs npm
sudo useradd --system --create-home --shell /usr/sbin/nologin bazdid || true
sudo mkdir -p /opt/bazdid
sudo chown -R bazdid:bazdid /opt/bazdid
```

ریپو را در `/opt/bazdid` کلون کنید و سپس:

```bash
cd /opt/bazdid
sudo -u bazdid npm install
sudo npx playwright install-deps chromium
sudo -u bazdid npx playwright install chromium
sudo -u bazdid npm run build
```

## اجرای دستی

```bash
cd /opt/bazdid
sudo -u bazdid npm start
```

برنامه هیچ خروجی در ترمینال چاپ نمی‌کند. برای توقف `Ctrl+C` بزنید.

## اجرای دائمی با systemd

```bash
sudo cp /opt/bazdid/deploy/bazdid.service /etc/systemd/system/bazdid.service
sudo systemctl daemon-reload
sudo systemctl enable --now bazdid
```

سرویس با `StandardOutput=null` و `StandardError=null` اجرا می‌شود و بعد از reboot نیز خودکار بالا می‌آید.

## تنظیم سایت‌ها

فایل `src/sites.ts` را ویرایش کنید. برای هر سایت می‌توان حداقل متن، حداقل حجم HTML، حداقل عناصر DOM و نسبت baseline را تنظیم کرد.

پس از تغییر:

```bash
cd /opt/bazdid
sudo -u bazdid npm run build
sudo systemctl restart bazdid
```

## نکته

این پروژه برای مانیتورینگ مجاز وب‌سایت‌های عمومی طراحی شده است. از proxy rotation، CAPTCHA bypass یا روش‌های دور زدن سیستم‌های ضدبات استفاده نمی‌کند و User-Agent آن به‌صورت شفاف `BazdidMonitor/1.0` است.
