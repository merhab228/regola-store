import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createCheckoutRecord } from '../server/checkout.js';

const raw = new DatabaseSync(':memory:');
raw.exec(fs.readFileSync(new URL('../server/db.js', import.meta.url), 'utf8').match(/db\.exec\(`([\s\S]*?)`\);/)[1]);
const db = {
  prepare(sql) { return raw.prepare(sql); },
  transaction(fn) { return () => { raw.exec('BEGIN'); try { const r = fn(); raw.exec('COMMIT'); return r; } catch(e) { raw.exec('ROLLBACK'); throw e; } }; },
};
const pause = () => new Promise(r => setTimeout(r, 1800));
console.log('REGOLA STORE | Демонстрация сохранения заказа в учебной SQLite');
console.log('Используется настоящий модуль server/checkout.js; внешние API не вызываются.');
await pause();
raw.exec("INSERT INTO categories (id,name) VALUES (1,'Дверные ручки')");
raw.prepare('INSERT INTO products (id,name,price,category_id,description,image,created_at) VALUES (1,?,2490,1,?,?,?)').run('Учебный товар Regola','Демонстрационная карточка','/demo.png',new Date().toISOString());
console.log('\n1. В базе создан учебный товар: id=1, цена=2490 рублей.');
console.log('Количество заказов до оформления:', raw.prepare('SELECT COUNT(*) AS n FROM orders').get().n);
await pause();
const request = {name:'Учебный покупатель',phone:'+79990000000',email:'demo@example.com',city:'Санкт-Петербург',address:'Учебный адрес',deliveryMethod:'СДЭК до ПВЗ',paymentMethod:'online',items:[{productId:1,qty:2,price:1}],total:2};
console.log('\n2. Покупатель выбирает 2 товара. В запросе намеренно подставлены price=1 и total=2.');
await pause();
const order = createCheckoutRecord(db,request);
console.log('\n3. Сервер читает цену из SQLite, рассчитывает сумму и сохраняет заказ транзакцией.');
console.log('Заказ:', JSON.stringify({orderId:order.orderId,goodsTotal:order.goodsTotal,deliveryPrice:order.deliveryPrice,total:order.total}));
assert.equal(order.goodsTotal,4980);
assert.equal(order.deliveryPrice,310);
assert.equal(order.total,5290);
console.log('Заказов после оформления:',raw.prepare('SELECT COUNT(*) AS n FROM orders').get().n);
console.log('Сохраненные позиции:',JSON.stringify(raw.prepare('SELECT product_id,qty,price FROM order_items').all()));
await pause();
console.log('\n4. Попытка оформить заказ с отрицательным количеством.');
try { createCheckoutRecord(db,{...request,items:[{productId:1,qty:-1}]}); assert.fail('Expected rejection'); } catch(e) { if(e.code==='ERR_ASSERTION') throw e; console.log('Сервер отклонил запрос:',e.message); }
assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM orders').get().n,1);
console.log('Количество заказов осталось 1. Проверки пройдены.');
console.log('Оплата и отправление СДЭК в этой демонстрации не создаются.');
raw.close();
