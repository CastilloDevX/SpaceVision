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
    return render_template('info-venus.html')

@app.route('/view/Jupiter')
def view_jupiter():
    return render_template('info-Jupiter.html')

@app.route('/view/Mars')
def view_mars():
    return render_template('info-Mars.html')

@app.route('/view/Uranus')
def view_urany():
    return render_template('info-urano.html')

@app.route('/view/Saturn')
def view_saturn():
    return render_template('info-saturno.html')

@app.route('/view/Neptune')
def view_neptune():
    return render_template('info-neptune.html')

@app.route('/view/Earth')
def view_earth():
    return render_template('info-earth.html')

@app.route('/museum')
def museum():
    return render_template('museum.html')
    

@app.route('/comparador')
def comparador():
    return render_template('Comparador.html')

if __name__ == '__main__':
    app.run(debug=True)
