---
title: "database.sqql"
published: 2026-05-07
description: ""
image: ""
tags:
  - ""
category: ""
draft: false
---

SELECT max(age) FROM user;
SELECT min(age) FROM user;
SELECT count(*) FROM user;
SELECT avg(age) FROM user;
select DISTINCT age from user;

select * from user u where u.id=12;
select * from user u where u.name='aa';

select * from user u where u.id=12 and u.name='bb'; 
select * from user u where u.id=12 or u.name='bb'; 

select * from user u where u.name is null; 
select * from user u where u.name=' '; 
select * from user u where u.name is not null; 

select * from user u where u.name like 'a%';
select * from user u where u.name like '%6';
select * from user u where u.name like '%a%';
select * from user u where u.name like '%1';
select * from user u where u.name like '%2_';
select * from user u where u.name like '%a__';
select * from user u where u.name like '%\_%';


select * from user u where u.scroe>=50;
select * from user u where u.scroe<=70;
select * from user u where u.scroe>=50 and u.scroe<=70;
select * from user u where u.scroe between 50 and 70;

select * from user u where u.scroe=50 or u.scroe=70 or u.scroe=67 or u.scroe=100;
select * from user u where u.scroe in(50,70,67,100);

select * from user u;
select * from user u limit 3;
select * from user u limit 0,3;
select * from user u limit 3,3;
select * from user u limit 6,3;
select * from user u limit 9,3;

select u.address,count(*) from user u group by u.address;
select u.address,max(u.scroe) from user u group by u.address;
