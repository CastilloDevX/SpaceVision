from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/view/Sun')
def view_sun():
    return render_template('info-sun.html')

@app.route('/view/Mercury')
def view_mercury():
    return render_template('info-mercury.html')

@app.route('/view/Venus')
def view_venus():
    return render_template('info-earth.html')

if __name__ == '__main__':
    app.run(debug=True)
