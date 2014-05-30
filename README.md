# php-getting-started

A barebones PHP bootstrap app that makes use of:

* The [Silex](http://silex.sensiolabs.org/) web framework
* [Twig](http://twig.sensiolabs.org/) templating
* PDO database access

## Running Locally

Make sure you have PHP, Apache and Composer installed.  Also, install the [Heroku Toolbelt](https://toolbelt.heroku.com/).

```sh
git clone git@github.com:jonmountjoy/php-getting-started.git # or clone your own fork
cd php-getting-started
composer update
foreman start web
```

Your app should now be running on [localhost:5000](http://localhost:5000/).

## Deploying to Heroku

```
heroku create
heroku addons:add heroku-postgresql:dev
git push heroku master
heroku open
```

You may want to add some data to the database too:

```
heroku pg:psql
> CREATE TABLE test_table (id integer, name text);
> INSERT INTO test_table VALUES (1, 'hello world');
```

## Documentation

For more information about using PHP on Heroku, see these Dev Center articles:

- [PHP on Heroku](https://devcenter.heroku.com/categories/php)
