create table if not exists `acc_log` (
       `ip` varchar(15) not null,
       `uri` varchar(100) not null,
       `agent` varchar(100) not null,
       `in_time` timestamp
);
