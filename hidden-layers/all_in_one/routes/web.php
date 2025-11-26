<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\StudentController;

Route::get('/wel', function () {
    return view('welcome');
});

Route::get('/student', [StudentController::class, 'index']);
